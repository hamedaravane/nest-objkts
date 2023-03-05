import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Objkt } from './entities/objkt.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ObjktsService {
  constructor(
    @InjectRepository(Objkt)
    private objktRepository: Repository<Objkt>,
    private readonly httpService: HttpService,
  ) {}

  async saveObjkt() {
    await this.objktRepository.save({});
  }

  async fetchGraphQLData(
    query: string,
    variables?: Record<string, any>,
    headers?: Record<string, any>,
  ): Promise<any> {
    const url = 'https://data.objkt.com/v3/graphql';

    const response = await this.httpService
      .post(url, { query, variables }, { headers })
      .toPromise();
    return response.data;
  }

  async getLatestObjkts() {
    const getLatestObjktQuery = {
      query: `query MyQuery {
          event(
            order_by: {id: desc, timestamp: desc}
            limit: 60
            where: {event_type_deprecated: {_eq: "ask_purchase"}}
          ) {
            creator_address
            fa_contract
            token {
              token_id
            }
          }
        }`,
    };
  }
}
