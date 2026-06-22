import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Customer } from '@generated/prisma/browser';
import { PrismaService } from '../database/prisma.service';
import { GetAllCustomersInDto } from './dto/get-all-customers.dto';
import { CustomerOutDto } from './dto/customer-out.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { buildCustomerSearchText, normalizeSearchText } from '@/libs/utils/search-text.util';
import { CUSTOMER_CODE_EXISTED, CUSTOMER_EMAIL_EXISTED, CUSTOMER_NOT_FOUND, CUSTOMER_PHONE_EXISTED } from '@/libs/constants/error.constants';
import { DeleteCustomersDto } from './dto/delete-customers.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllCustomers(query: GetAllCustomersInDto) {
    const { search, status, page, perPage } = query;
    const skip = (page - 1) * perPage;
    const searchText = normalizeSearchText(search);

    const where = {
      deletedAt: null,
      ...(status && {
        status,
      }),
      ...(searchText && {
        searchText: {
          contains: searchText,
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip,
        take: perPage,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items: items.map((customer) => this.toCustomerOut(customer)),
      total,
      page,
      perPage,
    };
  }

  async getCustomerById(id: string): Promise<CustomerOutDto> {
    const customer = await this.findExistingCustomerById(id);
    return this.toCustomerOut(customer);
  }

  async createCustomer(dto: CreateCustomerDto, userId: string): Promise<CustomerOutDto> {
    const { name, phone, email, address, identityNumber, socialContact, notes } = dto;

    await this.ensureCustomerUniqueFieldsAvailable(dto);

    const customer = await this.prisma.$transaction(async (tx) => {
      const code = await this.generateCustomerCode(tx);

      return tx.customer.create({
        data: {
          code,
          name,
          phone,
          email,
          address,
          identityNumber,
          socialContact,
          notes,
          createdBy: userId,
          searchText: buildCustomerSearchText({
            code,
            name,
            phone,
            email,
            identityNumber,
            socialContact,
          }),
        },
      });
    });

    return this.toCustomerOut(customer);
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto, userId: string): Promise<CustomerOutDto> {
    const existingCustomer = await this.findExistingCustomerById(id);
    await this.ensureCustomerUniqueFieldsAvailable(dto, id);

    const nextCustomer = {
      code: existingCustomer.code,
      name: dto.name ?? existingCustomer.name,
      phone: dto.phone ?? existingCustomer.phone,
      email: dto.email ?? existingCustomer.email,
      identityNumber: dto.identityNumber ?? existingCustomer.identityNumber,
      socialContact: dto.socialContact ?? existingCustomer.socialContact,
    };

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        identityNumber: dto.identityNumber,
        socialContact: dto.socialContact,
        notes: dto.notes,
        updatedBy: userId,
        searchText: buildCustomerSearchText(nextCustomer),
      },
    });

    return this.toCustomerOut(customer);
  }

  async updateCustomerStatus(id: string, dto: UpdateCustomerStatusDto, userId: string): Promise<CustomerOutDto> {
    await this.findExistingCustomerById(id);

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        status: dto.status,
        updatedBy: userId,
      },
    });

    return this.toCustomerOut(customer);
  }

  async deleteCustomers(dto: DeleteCustomersDto, userId: string): Promise<{ success: true }> {
    const uniqueIds = [...new Set(dto.customerIds)];
    if (uniqueIds.length === 0) {
      return { success: true };
    }

    await this.prisma.customer.updateMany({
      where: { id: { in: uniqueIds } },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    return { success: true };
  }

  private async findExistingCustomerById(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!customer) {
      throw new NotFoundException(CUSTOMER_NOT_FOUND);
    }

    return customer;
  }

  private async ensureCustomerUniqueFieldsAvailable(
    dto: {
      code?: string;
      email?: string;
      phone?: string;
    },
    excludedCustomerId?: string,
  ): Promise<void> {
    if (dto.code) {
      const existingCode = await this.prisma.customer.findFirst({
        where: {
          code: dto.code,
          ...(excludedCustomerId && {
            id: {
              not: excludedCustomerId,
            },
          }),
        },
        select: { id: true },
      });

      if (existingCode) {
        throw new BadRequestException(CUSTOMER_CODE_EXISTED);
      }
    }

    if (dto.email) {
      const existingEmail = await this.prisma.customer.findFirst({
        where: {
          email: dto.email,
          deletedAt: null,
          ...(excludedCustomerId && {
            id: {
              not: excludedCustomerId,
            },
          }),
        },
        select: { id: true },
      });

      if (existingEmail) {
        throw new BadRequestException(CUSTOMER_EMAIL_EXISTED);
      }
    }

    if (dto.phone) {
      const existingPhone = await this.prisma.customer.findFirst({
        where: {
          phone: dto.phone,
          deletedAt: null,
          ...(excludedCustomerId && {
            id: {
              not: excludedCustomerId,
            },
          }),
        },
        select: { id: true },
      });

      if (existingPhone) {
        throw new BadRequestException(CUSTOMER_PHONE_EXISTED);
      }
    }
  }

  private buildNextCustomerCode(latestCode?: string | null): string {
    const latestNumber = latestCode ? Number(latestCode.replace('CUS-', '')) || 0 : 0;
    return `CUS-${String(latestNumber + 1).padStart(6, '0')}`;
  }

  private async generateCustomerCode(tx: Pick<PrismaService, 'customer'>): Promise<string> {
    const latestCustomer = await tx.customer.findFirst({
      where: {
        code: {
          startsWith: 'CUS-',
        },
      },
      orderBy: {
        code: 'desc',
      },
      select: {
        code: true,
      },
    });

    return this.buildNextCustomerCode(latestCustomer?.code);
  }

  private toCustomerOut(customer: Customer): CustomerOutDto {
    return {
      id: customer.id,
      code: customer.code,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      identityNumber: customer.identityNumber,
      socialContact: customer.socialContact,
      notes: customer.notes,
      status: customer.status,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      deletedAt: customer.deletedAt,
    };
  }
}
