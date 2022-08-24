import { APIInteractionResponse } from 'discord-api-types/v9';

export class JsonResponse<D extends boolean = true> extends Response {
  constructor(
    body: D extends true ? APIInteractionResponse : Record<string, any>,
    init?: Response | ResponseInit | undefined
  ) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}
