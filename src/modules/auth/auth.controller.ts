import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUser, RefreshRequestUser } from './types/auth-user.type';
import { ApiNullableRes, ApiRes } from '@/libs/types/custom-response.type';
import { clearAuthCookies, setAuthCookies } from './utils/cookie.util';
import { ConfigService } from '@nestjs/config';
import { LoginResponseDto, MeResponseDto, SuccessResponseDto } from './dto/auth-response.dto';

@ApiTags('admin/auth')
@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Đăng nhập',
    description:
      'Đăng nhập vào hệ thống bằng email và mật khẩu. Response không trả token trong body; access token, refresh token và CSRF token được set qua cookies.',
  })
  @ApiBody({
    type: LoginDto,
    description: 'Thông tin đăng nhập bao gồm email và mật khẩu',
    examples: {
      'dang-nhap': {
        value: {
          email: 'admin@rental.local',
          password: 'Password123!',
        },
        summary: 'Thông tin đăng nhập',
      },
    },
  })
  @ApiOkResponse({
    description: 'Đăng nhập thành công và gán auth cookies.',
    type: LoginResponseDto,
  })
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<ApiRes> {
    const result = await this.authService.login(dto, request);
    setAuthCookies(response, this.configService, result.cookies);

    return new ApiRes({ user: result.user }, 'Đăng nhập thành công');
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @ApiOperation({
    summary: 'Làm mới phiên đăng nhập',
    description:
      'Đọc refresh token từ HttpOnly cookie, rotate refresh token, rotate CSRF token và set lại cookies mới.',
  })
  @ApiOkResponse({
    description: 'Refresh token thành công.',
    type: SuccessResponseDto,
  })
  async refresh(@CurrentUser() user: RefreshRequestUser, @Res({ passthrough: true }) response: Response): Promise<ApiRes> {
    const result = await this.authService.refresh(user);
    setAuthCookies(response, this.configService, result.cookies);

    return new ApiRes({ success: true }, 'Làm mới phiên đăng nhập thành công');
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Đăng xuất',
    description: 'Thu hồi phiên đăng nhập hiện tại và xóa toàn bộ auth cookies.',
  })
  @ApiOkResponse({
    description: 'Đăng xuất thành công.',
    type: SuccessResponseDto,
  })
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response): Promise<ApiNullableRes> {
    await this.authService.logout(user);
    clearAuthCookies(response, this.configService);

    return new ApiNullableRes({ success: true }, 'Đăng xuất thành công');
  }

  @Get('me')
  @ApiOperation({
    summary: 'Lấy thông tin tài khoản hiện tại',
    description: 'Trả về thông tin admin đang đăng nhập, bao gồm roles và permissions.',
  })
  @ApiOkResponse({
    description: 'Thông tin tài khoản hiện tại.',
    type: MeResponseDto,
  })
  async me(@CurrentUser() user: AuthUser): Promise<ApiRes> {
    return new ApiRes(await this.authService.getMe(user), 'Thông tin tài khoản');
  }
}
