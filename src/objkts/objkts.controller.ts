import { Controller, Get } from '@nestjs/common';
import { ObjktsService } from './objkts.service';

@Controller('objkts')
export class ObjktsController {
  constructor(private readonly objktsService: ObjktsService) {}

  @Get('get')
  getData(): Promise<any> {
    return this.objktsService.getData();
  }
}
