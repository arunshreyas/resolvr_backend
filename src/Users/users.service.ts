import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUserExists(id: number) {
    const user = await this.prisma.users.findUnique({
      where: { id },
      include: { complaints: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found.`);
    }

    return user;
  }

  findAll() {
    return this.prisma.users.findMany({
      orderBy: { id: 'asc' },
      include: { complaints: true },
    });
  }

  findOne(id: number) {
    return this.ensureUserExists(id);
  }

  create(data: CreateUserDto) {
    return this.prisma.users.create({
      data,
    });
  }

  async update(id: number, data: UpdateUserDto) {
    await this.ensureUserExists(id);

    return this.prisma.users.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    await this.ensureUserExists(id);

    return this.prisma.users.delete({
      where: { id },
    });
  }
}
