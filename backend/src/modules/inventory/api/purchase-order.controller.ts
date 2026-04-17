import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('inventory')
@Controller({ path: 'purchase-orders', version: '1' })
export class PurchaseOrderController {}
