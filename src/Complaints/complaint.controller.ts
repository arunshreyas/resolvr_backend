import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ComplaintsService } from './complaint.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';

@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Get()
  getComplaints() {
    return this.complaintsService.findAll();
  }

  @Get(':id')
  getComplaint(@Param('id', ParseIntPipe) id: number) {
    return this.complaintsService.findOne(id);
  }

  @Post()
  createComplaint(@Body() body: CreateComplaintDto) {
    return this.complaintsService.create(body);
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
