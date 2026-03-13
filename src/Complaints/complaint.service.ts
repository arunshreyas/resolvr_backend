import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../Users/users.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { DisputeChatDto } from './dto/dispute-chat.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';

@Injectable()
export class ComplaintsService {
  private readonly logger = new Logger(ComplaintsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  private async ensureComplaintExists(id: number) {
    const complaint = await this.prisma.complaints.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint with id ${id} not found.`);
    }

    return complaint;
  }

  findOne(id: number) {
    return this.ensureComplaintExists(id);
  }

  async findOneForClerkUser(id: number, clerkUserId: string) {
    const [complaint, user] = await Promise.all([
      this.ensureComplaintExists(id),
      this.usersService.findByClerkId(clerkUserId),
    ]);

    if (!user) {
      throw new UnauthorizedException(
        'No local user record found for this Clerk user. Configure Clerk webhooks first.',
      );
    }

    if (complaint.userId !== user.id) {
      throw new UnauthorizedException(
        'You do not have access to dispute this complaint.',
      );
    }

    return complaint;
  }

  findAll() {
    return this.prisma.complaints.findMany({
      orderBy: { id: 'asc' },
      include: { user: true },
    });
  }

  async getAdminBoard() {
    const [complaints, users, disputeAlerts] = await Promise.all([
      this.prisma.complaints.findMany({
        include: { user: true },
      }),
      this.prisma.users.findMany({
        select: {
          id: true,
          clerkId: true,
          email: true,
          name: true,
          _count: {
            select: {
              complaints: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      }),
      this.getDisputeAlerts(),
    ]);

    const rankedComplaints = this.rankComplaints(complaints);

    return {
      users: users.map((user) => ({
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        complaintCount: user._count.complaints,
      })),
      disputeAlerts,
      complaints: rankedComplaints,
    };
  }

  getDisputeAlerts() {
    return this.prisma.disputeAlerts.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        complaint: true,
        user: true,
      },
      take: 20,
    });
  }

  async update(id: number, data: UpdateComplaintDto) {
    const existingComplaint = await this.ensureComplaintExists(id);

    const complaintData = { ...data };
    delete complaintData.userEmail;

    const updatedComplaint = await this.prisma.complaints.update({
      where: { id },
      data: complaintData,
      include: { user: true },
    });

    if (
      typeof data.status !== 'undefined' &&
      data.status !== existingComplaint.status
    ) {
      await this.triggerComplaintStatusWebhook(
        updatedComplaint,
        existingComplaint.status,
        data.status,
      );
    }

    return updatedComplaint;
  }

  async remove(id: number) {
    await this.ensureComplaintExists(id);
    return this.prisma.complaints.delete({
      where: { id },
    });
  }

  async create(data: CreateComplaintDto, clerkUserId: string) {
    const complaintData = {
      title: data.title,
      description: data.description,
      latitude: data.latitude,
      longitude: data.longitude,
      status: data.status,
    };

    const user = await this.usersService.findByClerkId(clerkUserId);

    if (!user) {
      throw new UnauthorizedException(
        'No local user record found for this Clerk user. Configure Clerk webhooks first.',
      );
    }

    const complaint = await this.prisma.complaints.create({
      data: {
        ...complaintData,
        userId: user.id,
        userEmail: user.email,
      },
      include: { user: true },
    });

    await this.triggerN8nWebhook(complaint, user);

    return complaint;
  }

  async disputeComplaint(
    id: number,
    clerkUserId: string,
    data: DisputeChatDto,
  ) {
    const complaint = await this.findOneForClerkUser(id, clerkUserId);

    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENROUTER_API_KEY is not configured.',
      );
    }

    const model =
      this.configService.get<string>('OPENROUTER_MODEL') || 'openrouter/free';
    const siteUrl =
      this.configService.get<string>('OPENROUTER_SITE_URL') ||
      'http://localhost:3001';
    const appTitle =
      this.configService.get<string>('OPENROUTER_APP_NAME') || 'Resolvr';

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': siteUrl,
          'X-OpenRouter-Title': appTitle,
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 500,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: [
                'You are Resolvr Dispute Assistant.',
                'Help a citizen challenge or clarify the current status of a civic complaint.',
                'Use only the complaint context provided.',
                'Do not invent policies, laws, or evidence.',
                'Ask for concrete facts, timelines, photos, or on-ground evidence if needed.',
                'Be concise, practical, and respectful.',
                'When helpful, draft a short dispute message the user can send to the city team.',
                'Return strict JSON only with keys: reply, urgent, urgentReason.',
                'Set urgent to true only when there is a strong reason the admin team should review the dispute quickly.',
              ].join(' '),
            },
            {
              role: 'system',
              content: JSON.stringify({
                complaint: {
                  id: complaint.id,
                  title: complaint.title,
                  description: complaint.description,
                  status: complaint.status,
                  createdAt: complaint.createdAt,
                  updatedAt: complaint.updatedAt,
                  latitude: complaint.latitude,
                  longitude: complaint.longitude,
                },
                user: {
                  name: complaint.user?.name,
                  email: complaint.user?.email ?? complaint.userEmail,
                },
              }),
            },
            ...data.messages,
          ],
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `OpenRouter dispute chat failed with ${response.status}: ${errorText}`,
      );
      throw new InternalServerErrorException(
        'The dispute assistant could not respond right now.',
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      model?: string;
    };

    const content = payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new InternalServerErrorException(
        'The dispute assistant returned an empty response.',
      );
    }

    const parsed = this.parseDisputeResponse(content);
    const message = this.cleanAssistantReply(parsed.reply);
    const messageHtml = this.markdownToHtml(message);

    if (parsed.urgent) {
      await this.prisma.disputeAlerts.create({
        data: {
          complaintId: complaint.id,
          userId: complaint.userId,
          userEmail: complaint.user?.email ?? complaint.userEmail ?? 'Unknown',
          userMessage: data.messages[data.messages.length - 1]?.content ?? '',
          assistantResponse: message,
          urgentReason: parsed.urgentReason || null,
        },
      });
    }

    return {
      complaintId: complaint.id,
      status: complaint.status,
      model: payload.model || model,
      message,
      messageHtml,
      urgent: parsed.urgent,
      urgentReason: parsed.urgentReason || null,
      userEmail: complaint.user?.email ?? complaint.userEmail,
    };
  }

  private parseDisputeResponse(content: string) {
    const normalized = content
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    try {
      const parsed = JSON.parse(normalized) as {
        reply?: string;
        urgent?: boolean;
        urgentReason?: string;
      };

      return {
        reply: parsed.reply?.trim() || normalized,
        urgent: Boolean(parsed.urgent),
        urgentReason: parsed.urgentReason?.trim() || '',
      };
    } catch {
      return {
        reply: normalized,
        urgent: false,
        urgentReason: '',
      };
    }
  }

  private cleanAssistantReply(message: string) {
    return message
      .replace(/^#+\s*/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private markdownToHtml(markdown: string) {
    const escaped = this.escapeHtml(markdown);
    const blocks = escaped.split(/\n{2,}/).filter(Boolean);

    return blocks
      .map((block) => {
        const lines = block.split('\n').map((line) => line.trim());

        if (lines.every((line) => /^[-*]\s+/.test(line))) {
          const items = lines
            .map((line) => line.replace(/^[-*]\s+/, ''))
            .map((line) => `<li>${this.inlineMarkdownToHtml(line)}</li>`)
            .join('');
          return `<ul>${items}</ul>`;
        }

        if (lines.every((line) => /^\d+\.\s+/.test(line))) {
          const items = lines
            .map((line) => line.replace(/^\d+\.\s+/, ''))
            .map((line) => `<li>${this.inlineMarkdownToHtml(line)}</li>`)
            .join('');
          return `<ol>${items}</ol>`;
        }

        return `<p>${this.inlineMarkdownToHtml(lines.join('<br />'))}</p>`;
      })
      .join('');
  }

  private inlineMarkdownToHtml(value: string) {
    return value
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*(.+?)\*/g, '$1<em>$2</em>')
      .replace(/(^|[^_])_(.+?)_/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async triggerN8nWebhook(
    complaint: Awaited<ReturnType<PrismaService['complaints']['create']>>,
    user: Awaited<ReturnType<UsersService['findByClerkId']>>,
  ) {
    const webhookUrl =
      this.configService.get<string>('N8N_COMPLAINT_CREATED_WEBHOOK_URL') ||
      this.configService.get<string>('N8N_COMPLAINT_WEBHOOK_URL');

    if (!webhookUrl) {
      this.logger.warn(
        'N8N_COMPLAINT_CREATED_WEBHOOK_URL is not set. Skipping complaint created webhook.',
      );
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'complaint.created',
          complaint,
          user: {
            id: user?.id,
            clerkId: user?.clerkId,
            name: user?.name,
            email: user?.email,
          },
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `n8n webhook returned ${response.status} ${response.statusText}.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown webhook error';
      this.logger.error(`Failed to trigger n8n webhook: ${message}`);
    }
  }

  private async triggerComplaintStatusWebhook(
    complaint: Awaited<ReturnType<ComplaintsService['ensureComplaintExists']>>,
    previousStatus: string,
    newStatus: string,
  ) {
    const webhookUrl =
      this.configService.get<string>('N8N_COMPLAINT_STATUS_WEBHOOK_URL') ||
      this.configService.get<string>('N8N_COMPLAINT_WEBHOOK_URL');

    if (!webhookUrl) {
      this.logger.warn(
        'N8N_COMPLAINT_STATUS_WEBHOOK_URL is not set. Skipping complaint status webhook.',
      );
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'complaint.status_changed',
          complaint,
          previousStatus,
          newStatus,
          userEmail: complaint.user?.email ?? null,
          user: complaint.user
            ? {
                id: complaint.user.id,
                clerkId: complaint.user.clerkId,
                name: complaint.user.name,
                email: complaint.user.email,
              }
            : null,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Complaint status webhook returned ${response.status} ${response.statusText}.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown webhook error';
      this.logger.error(`Failed to trigger complaint status webhook: ${message}`);
    }
  }

  private rankComplaints(
    complaints: Awaited<ReturnType<PrismaService['complaints']['findMany']>>,
  ) {
    const clusters = new Map<
      string,
      Awaited<ReturnType<PrismaService['complaints']['findMany']>>
    >();

    for (const complaint of complaints) {
      const key = this.buildComplaintClusterKey(complaint);
      const existing = clusters.get(key) || [];
      existing.push(complaint);
      clusters.set(key, existing);
    }

    return complaints
      .map((complaint) => {
        const clusterKey = this.buildComplaintClusterKey(complaint);
        const similarComplaints = clusters.get(clusterKey) || [];
        const duplicateCount = similarComplaints.length;
        const isResolved = complaint.status === 'RESOLVED';
        const isRejected = complaint.status === 'REJECTED';
        const isActive =
          complaint.status === 'PENDING' || complaint.status === 'IN_PROGRESS';
        const ageInHours = Math.max(
          1,
          Math.floor(
            (Date.now() - new Date(complaint.createdAt).getTime()) / 36e5,
          ),
        );

        const duplicateBoost = Math.min(duplicateCount * 12, 120);
        const ageBoost = Math.min(ageInHours, 72);
        const statusBoost = isResolved ? 0 : isRejected ? 8 : 28;
        const geoBoost =
          complaint.latitude != null && complaint.longitude != null ? 6 : 0;
        const priorityScore =
          duplicateBoost + ageBoost + statusBoost + geoBoost;

        const priorityLabel =
          priorityScore >= 120
            ? 'Critical'
            : priorityScore >= 70
              ? 'High'
              : priorityScore >= 35
                ? 'Medium'
                : 'Low';

        const priorityReasons = [
          duplicateCount > 1
            ? `${duplicateCount} similar complaints reported`
            : 'Single report',
          isActive
            ? 'Still active in the civic queue'
            : isResolved
              ? 'Already resolved'
              : 'Marked rejected and may need review',
          ageInHours >= 24
            ? `Open for ${Math.floor(ageInHours / 24)} day(s)`
            : `Open for ${ageInHours} hour(s)`,
        ];

        return {
          ...complaint,
          priorityScore,
          priorityLabel,
          duplicateCount,
          priorityReasons,
          clusterKey,
        };
      })
      .sort((a, b) => {
        if (b.priorityScore !== a.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }

        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
  }

  private buildComplaintClusterKey(
    complaint: Awaited<ReturnType<PrismaService['complaints']['findMany']>>[number],
  ) {
    const normalizedTitle = complaint.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6)
      .join(' ');
    const normalizedDescription = complaint.description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6)
      .join(' ');
    const geoKey =
      complaint.latitude != null && complaint.longitude != null
        ? `${complaint.latitude.toFixed(3)}:${complaint.longitude.toFixed(3)}`
        : 'no-geo';

    return `${normalizedTitle}|${normalizedDescription}|${geoKey}`;
  }
}
