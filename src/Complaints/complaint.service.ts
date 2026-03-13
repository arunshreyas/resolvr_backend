import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';

@Injectable()
export class ComplaintsService {
    constructor(private readonly prisma: PrismaService) {}

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
        });    }
    
    async update(id: number, data: UpdateComplaintDto) {   
        await this.ensureComplaintExists(id);
        return this.prisma.complaints.update({
            where: { id },
            data,
        });
    }
    
    async remove(id: number) {
        await this.ensureComplaintExists(id);
        return this.prisma.complaints.delete({
            where: { id },
        });
    }

    async create(data: CreateComplaintDto) {
        return this.prisma.complaints.create({
            data,
        });
    }
}
