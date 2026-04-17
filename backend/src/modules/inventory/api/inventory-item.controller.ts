import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('inventory')
@Controller({ path: 'inventory-items', version: '1' })
export class InventoryItemController {}
