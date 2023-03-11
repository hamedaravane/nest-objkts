import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { MarketplaceEventType, SortDirection, Event } from './models/token.model';
import { firstValueFrom, map } from 'rxjs';

@Injectable()
export class ObjktsApiService {
  private readonly url: string = 'https://data.objkt.com/v3/graphql';
  private readonly headers: Record<string, string> = {
    'content-type': 'application/json',
    'Accept-Encoding': '*',
  };
  constructor(private readonly httpService: HttpService) {}

  async getTokens(): Promise<number[]> {
    const query = `
      query GetTokens($limit: Int!, $order_by: [event_order_by!], $where: event_bool_exp!) {
      event(
        order_by: $order_by
        limit: $limit
        where: $where
        ) {
        token_pk
      }
    }`;

    const variables = {
      limit: 59,
      order_by: [
        { id: SortDirection.DESCENDING },
        { timestamp: SortDirection.DESCENDING },
      ],
      where: { marketplace_event_type: { _eq: MarketplaceEventType.LIST_BUY } },
    };

    return await firstValueFrom(
      this.httpService
        .post(this.url, { query, variables }, { headers: this.headers })
        .pipe(
          map((response) => {
            if (response.data.errors) {
              console.log(response.data.errors);
            }
            return response.data.data.event.map((item) => item.token_pk);
          }),
        ),
    );
  }

  async getTokenEvents(tokenPk: number): Promise<any> {
    const query = `
          query GetTokenEvents($where: event_bool_exp!, $order_by: [event_order_by!]) {
            event(
              where: $where
              order_by: $order_by
            ) {
            amount
            creator {
              address
              alias
              email
              facebook
              instagram
              twitter
              tzdomain
            }
            event_type
            fa_contract
            marketplace {
              name
              contract
              group
              subgroup
            }
            marketplace_contract
            marketplace_event_type
            price
            recipient_address
            timestamp
            token {
              name
              mime
              pk
              average
              lowest_ask
              highest_offer
              supply
              token_id
              royalties {
                amount
                decimals
              }
            }
          }
        }`;

    const variables = {
      where: {
        timestamp: { _is_null: false },
        reverted: { _neq: true },
        token_pk: { _eq: tokenPk },
      },
      order_by: [
        { id: SortDirection.ASCENDING },
        { timestamp: SortDirection.ASCENDING },
      ],
    };

    return await firstValueFrom(
      this.httpService
        .post(this.url, { query, variables }, { headers: this.headers })
        .pipe(
          map((response) => {
            if (response.data.errors) {
              console.log(response.data.errors);
            }
            return response.data.data.event;
          }),
        ),
    );
  }
}
