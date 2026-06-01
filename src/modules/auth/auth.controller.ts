import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUser, RefreshRequestUser } from './types/auth-user.type';

@ApiTags('admin/auth')
@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOkResponse({ description: 'Logs in an admin user and sets auth cookies.' })
  login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.login(dto, request, response);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @ApiOkResponse({ description: 'Rotates refresh token and resets auth cookies.' })
  refresh(@CurrentUser() user: RefreshRequestUser, @Res({ passthrough: true }) response: Response) {
    return this.authService.refresh(user, response);
  }

  @Post('logout')
  @ApiOkResponse({ description: 'Revokes the current session and clears auth cookies.' })
  logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response) {
    return this.authService.logout(user, response);
  }

  @Get('me')
  @ApiOkResponse({ description: 'Returns the current authenticated admin user.' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user);
  }
}
