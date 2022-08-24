import {
  APIInteractionGuildMember,
  APIMessageComponentButtonInteraction,
  APIPingInteraction,
  ButtonStyle,
  ComponentType,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
  RouteBases,
  Routes,
} from 'discord-api-types/v9';
import { JsonResponse } from './util';
import { verify } from './verify';

export interface Env {
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
}

const Roles = {
  'he/him': '1011753836723064892',
  'she/her': '1011753874484367481',
  'they/them': '1011753924866343004',
  'Ask for pronouns': '1011753944722178119',
};
const RoleIds = Object.values(Roles);

async function handlePingRequest() {
  return new JsonResponse({ type: InteractionResponseType.Pong });
}

async function getStatsfmUserId(discordMember: APIInteractionGuildMember) {
  const getUserByDiscordId = await fetch(
    `https://beta-api.stats.fm/api/v1/private/get-user-by-discord-id?id=${discordMember.user.id}`
  );
  if (getUserByDiscordId.status !== 200) return null;
  const userData = (await getUserByDiscordId.json()) as {
    id: number;
    verified: boolean;
    userId: string;
  };

  return userData.userId;
}

async function getStatsfmUserProfile(statsfmUserId: string) {
  const user = await fetch(
    `https://beta-api.stats.fm/api/v1/users/${statsfmUserId}?time=${Date.now()}`
  );
  if (user.status !== 200) return null;
  const userData = (await user.json()) as {
    item: { profile?: { pronouns?: string } };
  };
  return userData.item;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    if (request.url.endsWith('/interaction') && request.method === 'POST') {
      if (!verify(request, env)) return new Response('', { status: 401 });
      const message = (await request.json()) as
        | APIPingInteraction
        | APIMessageComponentButtonInteraction;
      if (message.type === InteractionType.Ping) return handlePingRequest();

      if (message.type === InteractionType.MessageComponent) {
        if (
          message.data.custom_id === 'get_pronoun_roles' &&
          message.data.component_type === ComponentType.Button
        ) {
          const discordMember = message.member!;

          const statsfmUserId = await getStatsfmUserId(discordMember);

          if (!statsfmUserId) {
            return new JsonResponse({
              type: InteractionResponseType.ChannelMessageWithSource,
              data: {
                flags: MessageFlags.Ephemeral,
                content:
                  "It looks like you haven't linked your Stats.fm account to Discord yet. Please do so by clicking the link below.",
                components: [
                  {
                    type: ComponentType.ActionRow,
                    components: [
                      {
                        type: ComponentType.Button,
                        style: ButtonStyle.Link,
                        url: 'https://stats.fm/account/connections',
                        label: 'Link Stats.fm Account to Discord',
                      },
                    ],
                  },
                ],
              },
            });
          }
          const user = await getStatsfmUserProfile(statsfmUserId);
          if (!user || !user.profile) {
            return new JsonResponse({
              type: InteractionResponseType.ChannelMessageWithSource,
              data: {
                flags: MessageFlags.Ephemeral,
                content:
                  'Your privacy settings are prohibiting us from accessing your pronouns. Please update your privacy settings to allow us to access your pronouns and profile.',
              },
            });
          }
          if (!user.profile.pronouns || user.profile.pronouns === null) {
            return new JsonResponse({
              type: InteractionResponseType.ChannelMessageWithSource,
              data: {
                flags: MessageFlags.Ephemeral,
                content:
                  "It looks like you haven't set your pronouns yet. Please do so by clicking the link below.",
                components: [
                  {
                    type: ComponentType.ActionRow,
                    components: [
                      {
                        type: ComponentType.Button,
                        style: ButtonStyle.Link,
                        url: 'https://stats.fm/account',
                        label: 'Set pronouns',
                      },
                    ],
                  },
                ],
              },
            });
          }
          const pronouns = user.profile.pronouns;
          let pronounRole = Roles['Ask for pronouns'];
          if (pronouns === 'he/him') pronounRole = Roles['he/him'];
          else if (pronouns === 'she/her') pronounRole = Roles['she/her'];
          else if (pronouns === 'they/them') pronounRole = Roles['they/them'];
          const roleName = Object.keys(Roles).find(
            (key) => (Roles as Record<string, string>)[key] === pronounRole
          );
          if (discordMember.roles.includes(pronounRole)) {
            return new JsonResponse({
              type: InteractionResponseType.ChannelMessageWithSource,
              data: {
                flags: MessageFlags.Ephemeral,
                content: `You already have the **${roleName}** role.`,
              },
            });
          }

          const newRoles = discordMember.roles.filter(
            (role) => !RoleIds.includes(role)
          );
          newRoles.push(pronounRole);
          await fetch(
            `${RouteBases.api}${Routes.guildMember(
              message.guild_id!,
              discordMember.user.id
            )}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bot ${env.DISCORD_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ roles: newRoles }),
            }
          );

          return new JsonResponse({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              flags: MessageFlags.Ephemeral,
              content: `You have been given the **${roleName}** role.`,
            },
          });
        }
        return new JsonResponse({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            flags: MessageFlags.Ephemeral,
            content:
              "Something might have gone wrong here, message ModMail and we'll look into it!",
          },
        });
      }

      console.error('Unknown Type');
      return new JsonResponse<false>(
        { error: 'Unknown Type' },
        { status: 400 }
      );
    }
    return Response.redirect('https://stats.fm');
  },
};
