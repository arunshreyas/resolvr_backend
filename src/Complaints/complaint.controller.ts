import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../Clerk/clerk-auth.guard';
import { CurrentClerkUserId } from '../Clerk/current-clerk-user-id.decorator';
import { ComplaintsService } from './complaint.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { DisputeChatDto } from './dto/dispute-chat.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';

@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Get('dispute-alerts')
  getDisputeAlerts() {
    return this.complaintsService.getDisputeAlerts();
  }

  @Get()
  getComplaints() {
    return this.complaintsService.findAll();
  }

  @Get(':id')
  getComplaint(@Param('id', ParseIntPipe) id: number) {
    return this.complaintsService.findOne(id);
  }

  @Post()
  @UseGuards(ClerkAuthGuard)
  createComplaint(
    @CurrentClerkUserId() clerkUserId: string,
    @Body() body: CreateComplaintDto,
  ) {
    return this.complaintsService.create(body, clerkUserId);
  }

  @Post(':id/dispute-chat')
  @UseGuards(ClerkAuthGuard)
  disputeComplaint(
    @Param('id', ParseIntPipe) id: number,
    @CurrentClerkUserId() clerkUserId: string,
    @Body() body: DisputeChatDto,
  ) {
    return this.complaintsService.disputeComplaint(id, clerkUserId, body);
  }

  @Patch(':id')
  updateComplaint(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateComplaintDto,
  ) {
    return this.complaintsService.update(id, body);
  }

  @Delete(':id')
  deleteComplaint(@Param('id', ParseIntPipe) id: number) {
    return this.complaintsService.remove(id);
  }
}
