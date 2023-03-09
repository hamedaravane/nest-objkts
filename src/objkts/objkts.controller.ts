import { Controller, Get } from '@nestjs/common';
import { ObjktsService } from './objkts.service';
import { Observable } from 'rxjs';

@Controller('objkts')
export class ObjktsController {
  constructor(private readonly objktsService: ObjktsService) {}

  @Get('get')
  getData(): Promise<any> {
    return this.objktsService.getData();
  }
}
