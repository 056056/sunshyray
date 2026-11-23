# sunshyray

Sito portfolio e vetrina dei dipinti di **sunshyray**. È un sito statico ospitato su GitHub Pages: niente server e niente costi.

- `index.html`: il sito pubblico (bio, opere, contatti, in italiano e inglese)
- `studio/`: lo **studio**, il sito privato (protetto da password) da cui si caricano le opere
- `data/chiave.json`: la chiave di GitHub chiusa con la password (illeggibile senza password)
- `data/opere.json`: l'elenco delle opere (lo modifica lo studio)
- `data/sito.json`: bio e contatti (lo modifica lo studio)
- `data/quaderno.json`: le pagine del quaderno (lo modifica lo studio)
- `opere/`: le foto dei quadri
- `quaderno/`: le foto del quaderno

## Configurazione (una volta sola)

1. **Attiva GitHub Pages**: nel repo vai in *Settings → Pages → Build and deployment*, scegli *Deploy from a branch*, poi branch `main` e cartella `/ (root)`, e salva. Dopo un paio di minuti il sito è online su `https://<utente>.github.io/<repo>/`.
2. **Crea la chiave di accesso per lo studio**: vai su <https://github.com/settings/personal-access-tokens/new> e compila così:
   - *Token name*: `sunshyray studio`
   - *Expiration*: la scadenza più lunga possibile. Quando scade, basta crearne una nuova.
   - *Repository access*: **Only select repositories**, poi scegli questo repo
   - *Permissions → Repository permissions → Contents*: **Read and write**
   - Premi *Generate token* e copia la chiave, che inizia con `github_pat_…`.
3. Apri `https://<utente>.github.io/<repo>/studio/`, incolla la chiave e **scegli una password**. Va fatto una volta sola.
4. Da quel momento, da qualsiasi telefono, per entrare nello studio basta la password. Sul telefono di lei: apri lo studio, poi "Condividi → Aggiungi a Home", così diventa come un'app.

## Lo studio è solo per lei (sicurezza)

- Il sito pubblico non ha nessun link allo studio e nessun segno che esista.
- Chi apre `/studio/` vede solo l'anticamera, con la richiesta della password.
- La password si cambia dallo studio, nella scheda *Bio* (minimo 10 caratteri).
- La chiave di GitHub è salvata nel repo solo **cifrata** con la password (PBKDF2-SHA256 + AES-256-GCM): senza password è illeggibile.
- La chiave ha il minimo indispensabile: un solo repo, solo "Contents". Se qualcosa va storto si revoca da GitHub e se ne crea un'altra.
- Dopo l'ingresso il telefono resta dentro finché non si preme "esci". La password non scade: resta quella finché non la cambi.
- Il sito e lo studio hanno una Content Security Policy severa: possono caricare solo i propri file, i font di Google e (lo studio) parlare con GitHub. Lo studio non si apre dentro pagine altrui.
- Il codice del repo è pubblico (serve per GitHub Pages gratuito): la sicurezza non dipende dal nasconderlo, ma dalla password e dalla cifratura.
- Quando la chiave di GitHub scade: nell'anticamera tocca "Prima volta, o password dimenticata?", incolla una chiave nuova e scegli la password.

## Come si usa lo studio

- **＋ Opera**: **📷 Scatta la foto** apre la fotocamera (oppure *Scegli dalla galleria*). Lo studio **trova da solo gli angoli del quadro**; se serve li sistemi col dito (tenendo premuto compare una lente). Meglio fotografare di fronte, con un po' di muro intorno e senza flash. In ogni caso puoi trascinare i **4 pallini sugli angoli del quadro**: la foto viene raddrizzata e ritagliata, così si appoggia bene sulla tela. Scrivi titolo, descrizione, **dimensioni** (larghezza × altezza: servono anche a mostrare la tela più grande o più piccola, come dal vero), prezzo, poi premi **Pubblica**.
- **Ritocchi**: dopo *Raddrizza* la foto compare su una **tela finta appesa al muro**, esattamente come sul sito. Trascinando col dito sulla tela finta si sposta il quadro (destra, sinistra, su, giù). Sotto ci sono i cursori: *Ruota* (per raddrizzare di qualche grado), *Rifila i bordi* (sopra, sotto, sinistra, destra), *Luce*, *Contrasto*, *Calore*. Quello che vedi sulla tela finta è quello che viene pubblicato.
- **Quaderno**: come per le opere: *Scatta la foto* della pagina, la cornice dritta (con *Inclinazione*), poi i ritocchi con l'anteprima del foglio come apparirà nel quaderno, una nota facoltativa e *Aggiungi al quaderno*. Se è vuoto, la sezione sul sito resta nascosta.
- **Opere**: qui puoi modificare un'opera, segnarla come venduta o disponibile, cambiare l'ordine con ↑ ↓ o eliminarla.
- **Bio**: la frase d'apertura battuta a macchina (`~~parole~~` = cancellate a penna, `*parola*` = cerchiata in rosso), la bio (IT/EN), Instagram, email e WhatsApp. I link "scrivimi" sul sito usano questi contatti.

Dopo ogni modifica il sito si aggiorna in 1–2 minuti.

Le 6 opere `esempio-*` sono segnaposto: vanno eliminate dallo studio.

## Dominio personalizzato (facoltativo)

Se comprate un dominio (es. `sunshyray.art`), aggiungetelo in *Settings → Pages → Custom domain*. In quel caso scrivete `"utente/repo"` nel campo `repo` di `config.js`, così lo studio continua a trovare il repository.
