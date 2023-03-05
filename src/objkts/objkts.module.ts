import { Module } from '@nestjs/common';
import { HttpModule } from "@nestjs/axios";
import { Objkt } from './entities/objkt.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjktsService } from './objkts.service';
import { ObjktsController } from './objkts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Objkt]), HttpModule],
  providers: [ObjktsService],
  controllers: [ObjktsController],
})
export class ObjktsModule {}
