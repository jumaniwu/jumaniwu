import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GuestService, CreateGuestDto, UpdateGuestDto } from '../application/guest.service';
import { Roles } from '@shared/kernel/auth/roles.decorator';

@ApiTags('PMS — Guests')
@ApiBearerAuth()
@Controller({ path: 'guests', version: '1' })
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new guest' })
  @Roles('FRONT_DESK', 'MANAGER', 'HOTEL_ADMIN')
  create(@Body() dto: CreateGuestDto) {
    return this.guestService.create(dto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search guests by name, email or phone' })
  search(
    @Query('q') q: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.guestService.search(
      q ?? '',
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get guest by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.guestService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update guest profile' })
  @Roles('FRONT_DESK', 'MANAGER', 'HOTEL_ADMIN')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGuestDto) {
    return this.guestService.update(id, dto);
  }
}
