import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';

@Injectable()
export class ComplaintsService {
  private readonly logger = new Logger(ComplaintsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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

  findAll() {
    return this.prisma.complaints.findMany({
      orderBy: { id: 'asc' },
      include: { user: true },
    });
  }

  async update(id: number, data: UpdateComplaintDto) {
    await this.ensureComplaintExists(id);

    const complaintData = { ...data };
    delete complaintData.userEmail;

    return this.prisma.complaints.update({
      where: { id },
      data: complaintData,
    });
  }

  async remove(id: number) {
    await this.ensureComplaintExists(id);
    return this.prisma.complaints.delete({
      where: { id },
    });
  }

  async create(data: CreateComplaintDto) {
    const complaintData = { ...data };
    const userEmail = complaintData.userEmail;
    delete complaintData.userEmail;

    const complaint = await this.prisma.complaints.create({
      data: complaintData,
      include: { user: true },
    });

    await this.triggerN8nWebhook(complaint, userEmail);

    return complaint;
  }

  private async triggerN8nWebhook(
    complaint: Awaited<ReturnType<PrismaService['complaints']['create']>>,
    userEmail?: string,
  ) {
    const webhookUrl = this.configService.get<string>(
      'N8N_COMPLAINT_WEBHOOK_URL',
    );

    if (!webhookUrl) {
      this.logger.warn(
        'N8N_COMPLAINT_WEBHOOK_URL is not set. Skipping n8n complaint webhook.',
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
          userEmail,
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
}
