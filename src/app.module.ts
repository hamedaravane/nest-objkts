import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { DataSource } from 'typeorm';
import { ObjktsModule } from './objkts/objkts.module';
import { Objkt } from './objkts/entities/objkt.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: '11559933',
      database: 'objkts',
      entities: [Objkt],
      synchronize: true,
    }),
    ObjktsModule,
    HttpModule,
  ],
})
export class AppModule {
  constructor(private dataSource: DataSource) {}
}
