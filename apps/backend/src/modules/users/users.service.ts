import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

const selectUser = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: selectUser });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: selectUser });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(input: { email?: string; name?: string; password?: string; role?: Role }) {
    if (!input.email || !input.name || !input.password) {
      throw new BadRequestException('email, name and password are required');
    }

    return this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await bcrypt.hash(input.password, 12),
        role: input.role ?? Role.BD_EXECUTIVE,
      },
      select: selectUser,
    });
  }

  async update(
    id: string,
    input: { email?: string; name?: string; password?: string; role?: Role; isActive?: boolean },
  ) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        isActive: input.isActive,
        passwordHash: input.password ? await bcrypt.hash(input.password, 12) : undefined,
      },
      select: selectUser,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }
}
