import { Controller, Get } from "@nestjs/common";
import { ObjktsService } from "./objkts.service";

@Controller('objkts')
export class ObjktsController {
  constructor(private readonly objktsService: ObjktsService) {}

  @Get()
  async getData(): Promise<any> {
    const query = `query MyQuery {
  event {
    creator_address
    fa_contract
    token {
      token_id
    }
  }
}
`;

    return await this.objktsService.fetchGraphQLData(query);
  }
}
