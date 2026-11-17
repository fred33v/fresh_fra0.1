# Terminer le test de signature sur votre Mac

Cette procédure utilise le bucket existant **fresh-fra-s**, à Londres (**eu-west-2**), une base PostgreSQL locale et votre propre adresse email. Elle ne déploie pas l’application en production. Le certificat créé est un certificat de développement : il prouve l’intégrité du PDF, pas une identité qualifiée eIDAS.

## 1. Terminer l’utilisateur IAM depuis votre écran actuel

1. Sélectionnez **Attach policies directly**.
2. Recherchez et cochez **SignInLocalDevelopmentAccess**. N’ajoutez pas AdministratorAccess ou AmazonS3FullAccess.
3. Cliquez **Next**, puis **Create user**. Le nom utilisé ci-dessous est **fresh-fra-local**.
4. Enregistrez l’URL de connexion et le mot de passe dans votre gestionnaire de mots de passe, jamais dans le chat.
5. Si vous devez changer le mot de passe lors de la première connexion, connectez-vous une première fois avec cet utilisateur et terminez cette étape.
6. Revenez dans la console administrative : **IAM → Users → fresh-fra-local → Permissions → Add permissions → Create inline policy → JSON**.
7. Remplacez le JSON par le contenu du fichier [esign-fresh-fra-s-policy.json](examples/esign-fresh-fra-s-policy.json). Cliquez **Next**, nommez la politique **FreshFraEsignStorage**, puis créez-la.

La politique limite l’application au préfixe `esign/` de ce bucket. Elle refuse les suppressions et la désactivation du legal hold. L’impossibilité de lister tous les buckets dans la console avec cet utilisateur est normale.

## 2. Connecter le terminal à cet utilisateur

Dans le Terminal du Mac :

```bash
aws login --profile fresh-fra-local --region eu-west-2
```

Dans le navigateur, autorisez **fresh-fra-local**, pas le compte root. Attendez le message de réussite dans le terminal, puis :

```bash
aws sts get-caller-identity --profile fresh-fra-local --query Arn --output text
```

L’ARN doit se terminer par `user/fresh-fra-local`, jamais `:root`. Créez ensuite le profil utilisé par le SDK :

```bash
aws configure set credential_process "aws configure export-credentials --profile fresh-fra-local --format process" --profile fresh-fra-app
aws configure set region eu-west-2 --profile fresh-fra-app
aws s3api get-bucket-versioning --bucket fresh-fra-s --profile fresh-fra-app --region eu-west-2
aws s3api get-object-lock-configuration --bucket fresh-fra-s --profile fresh-fra-app --region eu-west-2
```

Attendez `Enabled` pour le versionnement et Object Lock. Vous les avez déjà vérifiés avec votre profil administratif. Ne créez pas de clé d’accès root. Si la session expire, relancez `aws login` pour `fresh-fra-local`.

## 3. Récupérer le code

Dans le dossier de votre projet sur le Mac :

```bash
git status --short
git fetch origin
git switch phase-2/web-backend-review
git pull --ff-only
npx --yes pnpm@9.15.4 install --frozen-lockfile
```

Si Git signale des modifications locales empêchant le changement de branche, conservez-les ; ne lancez pas de commande de suppression ou de réinitialisation.

## 4. Préparer une base locale isolée

Avec Homebrew :

```bash
brew install postgresql@17
brew services start postgresql@17
"$(brew --prefix postgresql@17)/bin/createdb" fresh_fra_esign_dev
```

Si PostgreSQL 17 est déjà installé, l’installation peut être omise. Si cette base existe déjà, ne la supprimez pas : vérifiez qu’elle est réservée à ces essais. Ne réutilisez pas la connexion Neon de production.

## 5. Créer le certificat de test

Depuis la racine du projet :

```bash
cd apps/fra-backend/backend
bash scripts/esign-create-test-seal.sh "$PWD/.local/esign"
pwd
```

OpenSSL demande un mot de passe d’exportation : choisissez-le et conservez-le. Le fichier créé est `.local/esign/seal-test.p12`. Notez son chemin absolu, obtenu en ajoutant `/.local/esign/seal-test.p12` au résultat de `pwd`.

## 6. Préparer les emails

Vous pouvez utiliser un compte SMTP existant. Il faut son serveur, port, utilisateur, mot de passe SMTP et une adresse d’expéditeur autorisée.

Pour utiliser AWS SES en test :

1. Dans la console AWS administrative, ouvrez **Amazon SES**, région **Europe (London)**.
2. Ouvrez **Verified identities → Create identity → Email address**. Indiquez votre propre adresse, puis validez le lien reçu par email.
3. Ouvrez **SMTP settings → Create SMTP credentials**. Terminez l’assistant de création de l’utilisateur SMTP et enregistrez les identifiants SMTP dans votre gestionnaire de mots de passe.
4. Utilisez le serveur `email-smtp.eu-west-2.amazonaws.com`, port `587`, avec STARTTLS.
5. Pour cet essai, utilisez votre adresse vérifiée à la fois comme expéditeur et destinataire. Cela permet de rester dans le sandbox SES, sans demander l’accès de production.

Les identifiants SMTP sont distincts du mot de passe de connexion AWS et du profil `aws login`. L’envoi et le stockage peuvent être facturés par AWS selon votre compte.

## 7. Configurer le backend local

Toujours dans `apps/fra-backend/backend`, ouvrez `.env.local` avec votre éditeur :

```bash
nano .env.local
```

Préservez les autres réglages nécessaires, mais remplacez les valeurs de ces variables. Chaque variable ne doit apparaître qu’une fois. Remplacez les indications entre chevrons ; ne les laissez pas telles quelles.

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3080
DATABASE_URL=postgresql://fred@127.0.0.1:5432/fresh_fra_esign_dev
DATABASE_URL_UNPOOLED=postgresql://fred@127.0.0.1:5432/fresh_fra_esign_dev
AWS_PROFILE=fresh-fra-app
AWS_REGION=eu-west-2
ESIGN_S3_BUCKET=fresh-fra-s
ESIGN_ENABLED=false
ESIGN_PUBLIC_URL=http://localhost:3080
ESIGN_RETENTION_DAYS=365
ESIGN_P12_PATH=<chemin absolu vers seal-test.p12>
ESIGN_P12_PASSPHRASE="<votre mot de passe du certificat>"
SMTP_HOST=email-smtp.eu-west-2.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=<utilisateur SMTP>
SMTP_PASS="<mot de passe SMTP>"
EMAIL_FROM=<votre adresse vérifiée>
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
WEBHOOK_WORKER_ENABLED=false
RETENTION_ENABLED=false
```

`fred` est votre utilisateur PostgreSQL local ; adaptez-le si votre installation utilise un autre rôle. Dans nano : Ctrl+O, Entrée, puis Ctrl+X pour enregistrer et quitter.

Ajoutez un secret OTP généré automatiquement, sans l’afficher :

```bash
node --input-type=module <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const path = '.env.local';
const old = readFileSync(path, 'utf8').replace(/^ESIGN_OTP_SECRET=.*\n?/gm, '');
writeFileSync(path, old.trimEnd() + '\nESIGN_OTP_SECRET=' + randomBytes(32).toString('hex') + '\n', { mode: 0o600 });
NODE
chmod 600 .env.local
```

Ne partagez ni ce fichier ni le P12. N’exportez pas simultanément d’anciennes variables de connexion dans le terminal : les variables déjà exportées ont priorité sur `.env.local`.

## 8. Migrer, construire et vérifier

Depuis le backend :

```bash
npm run migrate
npm run esign:check
```

Le contrôle doit afficher `PASS`. Il ne crée pas d’objet et n’envoie pas d’email ; il ne constitue donc pas encore le test réel.

Depuis la racine du projet, construisez toute l’application :

```bash
cd ../../..
npx --yes --package=pnpm@9.15.4 -c 'npm run build'
cd apps/fra-backend/backend
```

Corrigez toute erreur avant de continuer. Ensuite, modifiez uniquement `ESIGN_ENABLED=false` en `ESIGN_ENABLED=true` dans le fichier local.

## 9. Démarrer le serveur

Dans ce premier terminal, depuis le backend :

```bash
npm run dev
```

Laissez-le ouvert. Dans le navigateur du même Mac, ouvrez `http://localhost:3080/health` pour vérifier que le serveur répond.

## 10. Exécuter le parcours réel

Ce test crée des documents synthétiques dans S3 : **rétention COMPLIANCE de 365 jours, plus legal hold sans expiration automatique**. Les objets restent conservés ; ce n’est pas un test effaçable. N’utilisez pas un vrai contrat personnel. Le script refuse une base distante et des identifiants root.

Ouvrez un deuxième terminal dans `apps/fra-backend/backend` puis lancez, en remplaçant l’adresse :

```bash
ESIGN_LIVE_TEST=1 npm run esign:demo -- votre-adresse-verifiee@example.com
```

1. Gardez le script ouvert ; il attend jusqu’à 15 minutes.
2. Ouvrez l’invitation reçue **sur ce même Mac**, car son lien utilise localhost.
3. Demandez le code à usage unique et consultez le second email.
4. Saisissez le code, ouvrez et lisez le document de test.
5. Cochez le consentement, saisissez le nom demandé et signez.
6. Revenez au terminal. Le script vérifie les versions S3, la rétention COMPLIANCE, le legal hold, le condensat du PDF, le point de contrôle du journal et le scellement CMS avec OpenSSL.
7. Conservez la sortie `PASS` et les fichiers générés sous `.local/esign/results/`. Ne partagez pas de lien de signature, code ou secret.

En cas d’expiration de la session AWS, reconnectez `fresh-fra-local`, redémarrez le serveur et relancez le test. En cas d’erreur SMTP SES, vérifiez la région, les identifiants SMTP et la vérification de l’expéditeur **et** du destinataire. Ne contournez pas une erreur IAM avec AdministratorAccess.

## Ce qui constitue la fin de cette configuration

- Construction de l’application réussie.
- Invitation et code reçus réellement, puis consentement et signature effectués.
- Vérifications du PDF et des protections S3 réussies dans le script.

Ce résultat valide le module sur votre Mac. La mise en production nécessite encore un domaine HTTPS, un hébergement, des secrets injectés côté serveur, une identité AWS de service et un certificat de scellement approprié. Le certificat de test n’est pas une signature avancée ou qualifiée. Les autres fonctionnalités de Phase 1, notamment les commissions Stripe Connect, ne sont pas clôturées par ce test.
