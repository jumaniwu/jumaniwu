import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Patch,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService, LoginDto } from './auth.service';
import { Public } from './roles.decorator';

export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
}

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email + password, returns JWT' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for the current user' })
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    const { sub: userId, hotelId } = req.user;
    return this.authService.changePassword(userId, hotelId, dto.oldPassword, dto.newPassword);
  }
}
