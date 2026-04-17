import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';

export interface LoginDto {
  hotelId: string;
  email: string;
  password: string;
}

export interface AuthTokenPayload {
  sub: string;
  hotelId: string;
  email: string;
  role: string;
  fullName: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    hotelId: string;
    email: string;
    fullName: string;
    role: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password_hash')
      .where('u.hotel_id = :hotelId', { hotelId: dto.hotelId })
      .andWhere('u.email = :email', { email: dto.email.toLowerCase().trim() })
      .getOne();

    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Invalid email or password');

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    const payload: AuthTokenPayload = {
      sub: user.id,
      hotelId: user.hotelId,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '8h' });

    return {
      accessToken,
      user: {
        id: user.id,
        hotelId: user.hotelId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async createUser(
    hotelId: string,
    email: string,
    password: string,
    fullName: string,
    role: string,
  ): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = this.userRepo.create({
      hotelId,
      email: email.toLowerCase().trim(),
      passwordHash,
      fullName,
      role,
    });
    return this.userRepo.save(user);
  }

  async changePassword(
    userId: string,
    hotelId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password_hash')
      .where('u.id = :userId', { userId })
      .andWhere('u.hotel_id = :hotelId', { hotelId })
      .getOne();

    if (!user) throw new NotFoundException('User not found');

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(userId, { passwordHash: newHash });
  }
}
