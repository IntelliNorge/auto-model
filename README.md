# auto-model

En Claude Code-mod som velger den billigste modellen som passer til hver prompt, slik at du ikke bruker Opus på en oppgave Haiku klarer.

## Slik virker den

1. Når du sender en prompt, ber moden Haiku om å klassifisere oppgaven som `haiku`, `sonnet` eller `opus`.
2. Turen kjøres på den modellen. Moden går **aldri over** modellen du har valgt med `/model`: hvis du har valgt Sonnet, kan den gå ned til Haiku, men aldri opp til Opus.
3. Statuslinjen viser valget, for eksempel `Auto-model: Haiku (instead of Opus)`.

Subagenter beholder sine egne modeller. Hvis klassifiseringen feiler, brukes modellen du har valgt.

## Kommandoer

| Kommando | Virkning |
| --- | --- |
| `/auto-model` | Slår av eller på |
| `/auto-model on` / `off` | Slår på / av |
| `/auto-model status` | Viser om moden er på, og forrige valg |

Innstillingen huskes på tvers av økter. Moden er på som standard.

## Installasjon

Skriv dette i promptfeltet i en Claude Code-økt i terminalen:

```
/plugin install auto-model --marketplace Marensius-Andersen/auto-model
```

Svar `y` for å legge til markedsplassen, og velg deretter scope (user anbefales).

## Verdt å vite

- Hver prompt koster ett lite Haiku-kall til klassifiseringen.
- Når modellen byttes midt i en samtale, må konteksten mellomlagres på nytt for den nye modellen (prompt-cache). I lange samtaler kan det spise noe av besparelsen.
- Modell-ID-ene står øverst i `hooks/register.ts` (`MODELS`). Oppdater dem når nye modeller kommer.
