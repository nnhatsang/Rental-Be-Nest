import { MailTemplateKey } from './mail-template.const';

export type MailTemplateVariableType = 'text' | 'url' | 'number';

export type MailTemplateCatalogDefinition = {
  key: string;
  label: string;
  category: string;
  description: string;
  variables: Array<{
    key: string;
    label: string;
    type: MailTemplateVariableType;
    required: boolean;
    sampleValue: string | number;
  }>;
  samplePayload: Record<string, unknown>;
};

export const mailTemplateCatalog: MailTemplateCatalogDefinition[] = [
  {
    key: MailTemplateKey.AuthResetPassword,
    label: 'Đặt lại mật khẩu',
    category: 'auth',
    description: 'Gửi khi người dùng yêu cầu tạo lại mật khẩu.',
    variables: [
      { key: 'userName', label: 'Tên người dùng', type: 'text', required: true, sampleValue: 'Nguyễn Văn A' },
      {
        key: 'resetPasswordUrl',
        label: 'Link đặt lại mật khẩu',
        type: 'url',
        required: true,
        sampleValue: 'https://admin.example.com/auth/reset-password?token=sample',
      },
      { key: 'expiresInMinutes', label: 'Thời hạn (phút)', type: 'number', required: true, sampleValue: 30 },
      { key: 'appName', label: 'Tên ứng dụng', type: 'text', required: true, sampleValue: 'Rental Admin' },
    ],
    samplePayload: {
      userName: 'Nguyễn Văn A',
      resetPasswordUrl: 'https://admin.example.com/auth/reset-password?token=sample',
      expiresInMinutes: 30,
      appName: 'Rental Admin',
    },
  },
];
