# Plan de développement QSCHOOL

Ce plan reprend le cahier des charges **SMART SCHOOL — novembre 2026**, adapté au produit QSCHOOL existant. Il conserve l’application mono-établissement et le stack actuel; les éléments Lovable Cloud, Supabase, Resend et jsPDF du cahier des charges ne sont pas des prérequis.

## 1. État de départ

### Déjà présent dans le web

Configuration initiale et connexion; rôles admin, enseignant, parent et élève; dossiers et imports élèves/personnel; classes, inscriptions, salles et emplois du temps avec détection de conflits; présences; carnets de notes; génération/publication de bulletins; comportement, sorties et transferts; factures, paiements et types de frais; annonces, messagerie, calendrier; rapports, export SIS, paramètres d’e-mail et d’IA, journal d’audit.

### Partiel ou à valider

- Les modules web ont leurs pages et actions serveur, mais les tests Playwright couvrent surtout les écrans et quelques actions. Un build Next.js réussi et le smoke test Docker/`/api/health` ne prouvent pas que tous les parcours métier passent.
- L’action de création de l’établissement valide les champs côté serveur et sérialise la configuration pour éviter les doubles soumissions concurrentes. Le parcours doit encore être rejoué de bout en bout sur PostgreSQL avec un profil propre.
- Les notes de chaque matière sont normalisées sur 100 puis pondérées par le coefficient de chaque évaluation; ce calcul alimente les bulletins et portails famille. La planification d’examens est disponible avec brouillon/publication/annulation, contrôle des conflits et création du carnet de notes lié. Les bulletins ont un workflow d’approbation attribué et un historique des versions. Les portails web/mobile exposent les bulletins approuvés, notes, appréciations, examens publiés et emploi du temps.
- Les finances couvrent les frais scolaires, factures et paiements. Les cinq montants de frais/facture/paiement utilisent désormais `Decimal(14,2)`; la migration PostgreSQL arrondit explicitement à deux décimales. Les entrées sont contrôlées au centime, les paiements excédentaires refusés et les écritures concurrentes protégées. Le paramétrage reste limité à un symbole de devise; dépenses, paie, taxes et multi-devises sont absentes.
- La base SQLite historique a maintenant été importée sur PostgreSQL après inspection, sauvegarde et dry-run. Les comptes de démonstration connus ont été désactivés; l’inventaire et la procédure de restauration sont dans `docs/sqlite-inventory.md`.

### Déjà présent dans le mobile

Connexion par API; access token d’une heure et refresh token renouvelable sur 30 jours, stockés dans SecureStore et révocables à la déconnexion; portail élève/parent avec présences, notes, annonces, bulletins publiés et emploi du temps. Les enseignants ont la saisie des présences et notes. Les admins ont maintenant des onglets dédiés pour le tableau de bord, les classes, les élèves, les présences et les notes. La gestion complète des dossiers, factures, rapports et paramètres reste web. Les builds Android ARM64 et iOS simulateur de cette navigation sont en cours sur EAS.

### Absent du mobile ou non validé sur appareil

L’écran mobile a des onglets distincts pour le résumé, les bulletins, le planning et les annonces côté famille, et les présences/notes côté enseignant. Le client renouvelle les jetons; une indisponibilité temporaire de l’API ne supprime plus les identifiants enregistrés. Le mobile n’a pas la gestion complète des élèves, factures, rapports, paramètres ou messagerie web. Pas de notifications push ni recette sur appareils réels. Le build iOS actuel est pour simulateur; installer sur iPhone nécessite une signature Apple. Les builds utilisent encore une URL d’API temporaire.

## 2. Plan par étapes

### Étape 0 — Fiabiliser la base de lancement (P0)

La migration SQLite vers PostgreSQL est faite et contrôlée. L’assistant valide les données côté serveur et protège la création initiale par une transaction sérialisable; le parcours a passé son scénario E2E sur une base vierge. Le script de sauvegarde écrit un dump temporaire, vérifie son archive puis le publie atomiquement; `scripts/verify-postgres-backup.sh` a restauré et validé une sauvegarde dans une base temporaire, ensuite supprimée. Garder l’URL temporaire limitée aux essais; choisir le domaine HTTPS et remplacer l’URL de tunnel dans les environnements EAS avant une diffusion externe.

**État :** import exécuté; `/api/health` confirme PostgreSQL et les relations importées sont valides. Le domaine permanent reste à définir avant publication.

### Étape 1 — Recetter et sécuriser les parcours web cœur (P0)

Compléter les tests E2E sur base isolée : création de l’école, connexion/déconnexion, droits par rôle, création élève/personnel/classe, inscription, emploi du temps, présence, saisie des notes, facture/paiement et communication. Les sélecteurs de configuration, connexion, élèves et finances suivent maintenant les libellés français actuels; la suite vérifie encore surtout le rendu des pages et nécessite des scénarios métier/assertions de droits. Vérifier les actions serveur, validations, suppression/annulation et isolation des données. Le rôle comptable est ajouté comme accès finance uniquement, sans droits d’administration générale. Les actions de gestion des élèves exigent le rôle admin; les enseignants ne voient que les élèves de leurs classes et leur emploi du temps de l’année active. Les écritures/codes de présence contrôlent l’affectation, le trimestre et les inscriptions, y compris hors ligne. Les classes, bulletins, PDF, notes, incidents et alertes d’absentéisme enseignants sont limités aux élèves/classes affectés; seuls les auteurs ou admins modifient un incident. Les notes de direction et suspensions restent réservées à l’admin. Les comptes comptables ne sont pas proposés comme destinataires de communication. Le cron financier échoue fermé si son secret manque. Des en-têtes HTTP de protection (anti-MIME, anti-framing et politique de référent) sont activés; HSTS attend le domaine HTTPS et une CSP de ressources complète reste à définir. La connexion, la récupération de compte, l’assistant de configuration, la navigation, le tableau de bord, les écrans principaux des finances et la liste/création des élèves sont traduits en français; les autres modules métier restent à localiser. La recette automatisée et la vérification mobile/PWA restent à faire.

Le runner Playwright exige `E2E_DATABASE_URL` vers une base PostgreSQL locale dédiée dont le nom comporte `e2e` ou `test`; il applique les migrations, utilise un port séparé et refuse les serveurs déjà lancés. La suite a passé 31/31 tests Chromium sur une base E2E vierge. Les scénarios couvrent l’assistant, la connexion, la création d’un élève, les principaux rendus de modules, la santé API et l’authentification API mobile; les scénarios d’écriture métier et de droits par rôle restent à renforcer.

Le parcours des devoirs et de leur remise est localisé. Pour les parents ayant plusieurs enfants associés, le sélecteur charge maintenant les devoirs de l’enfant choisi et l’action serveur vérifie l’association parent-élève avant l’accès aux données.

La charge de travail (corrections en attente, échéances et classes) est aussi localisée. Un compte enseignant sans fiche personnel associée reçoit maintenant une liste vide au lieu de retomber sur la portée administrateur.

La planification des examens, ses statuts, ses actions de publication/annulation et ses retours de validation sont localisés; les dates et heures restent explicitement affichées en UTC.

Le tableau, l’appel en ligne/hors ligne et le rapport des présences sont localisés. Les classes visibles et la page d’appel sont restreintes à l’année active; l’enregistrement d’un appel valide toute la liste puis écrit les lignes dans une transaction unique.

La liste, le formulaire, l’import CSV, le profil et les demandes de congé du personnel sont localisés. L’import crée chaque compte dans une transaction, remet les mots de passe temporaires à l’admin une seule fois et ne renvoie pas les détails des erreurs techniques. L’approbation/refus des congés affiche ses erreurs et les notifications associées sont en français.

La liste, le formulaire, le dossier et l’édition des classes ainsi que les vues, la planification manuelle, l’assistant par lot et le générateur d’emploi du temps sont localisés. Le lien « Modifier la classe » pointe maintenant vers une vraie page réservée à l’admin. Les classes n’affichent aucune année si aucune n’est active; créer une classe et son enseignant principal est atomique. Le remplacement d’un planning généré valide côté serveur les classes, horaires et conflits, puis enregistre le tout en transaction sérialisable.

**Livré quand :** ces parcours passent sur Docker/PostgreSQL avec jeux de données propres et les accès interdits sont testés.

### Étape 2 — Compléter pédagogie et portail famille (P1)

Les coefficients pondérés par matière sont en place, avec contrôle des notes dans le barème et des droits d’écriture enseignants. La planification d’examens avec conflits salle/surveillant/classe, carnet de notes associé et publication aux familles est en place. Le workflow brouillon → révision → approbation/rejet des bulletins, l’historique attribué, le portail académique parent/élève, le PDF publié individuel et l’archive ZIP des bulletins approuvés d’un trimestre sont en place.

**Livré quand :** un bulletin non publié n’est jamais visible par famille; chaque validation/publication est attribuable et vérifiable.

### Étape 3 — Étendre finances et services scolaires (P1/P2)

La migration des montants financiers vers `Decimal(14,2)` et les validations au centime sont en place. Avant dépenses et paie, définir la devise ISO, les taxes, références et règles d’arrondi. Ajouter ensuite le registre des dépenses et salaires, puis des rapports financiers exportables. Prioriser cantine, transport et bibliothèque selon les besoins de l’école; aucun de ces modules n’existe aujourd’hui comme parcours exploitable.

**Livré quand :** chaque écriture financière est équilibrée, traçable, autorisée par rôle et couverte par tests.

### Étape 4 — Finir le mobile MVP (P1)

Les parcours mobiles distincts sont en place : portail famille (enfants liés, présences, notes pondérées, bulletins publiés, emploi du temps, examens et annonces) et portail enseignant/admin (classes, saisie des présences et notes). Les access tokens expirés sont renouvelés via des refresh tokens rotatifs et la déconnexion les révoque; le client conserve les identifiants pendant une panne réseau temporaire. Il reste la recette sur appareils réels, la signature des builds de distribution et le remplacement de l’URL temporaire.

**Livré quand :** les parcours essentiels passent sur Android et iPhone réel, avec API permanente; builds de distribution signés et procédure d’installation documentée.

### Étape 5 — Conformité, audit et licences (P2, après revue)

Enrichir l’audit avec anciennes/nouvelles valeurs pour les données sensibles. Étudier archivage à empreintes chaînées, vérification publique des bulletins/cartes, politique de conservation et purge RGPD avec validation juridique locale. Introduire les plans Basic/Pro/Premium seulement après définition des modules et règles d’activation. Le cahier des charges exclut le multi-établissement, Stripe et les notifications push : les laisser hors première livraison.

## 3. Implémentation dans le stack QSCHOOL

- Interface : Next.js App Router, React, TypeScript, Tailwind et composants déjà installés.
- Données : PostgreSQL + Prisma; migrations versionnées et opérations métier côté serveur.
- Authentification : sessions et bcrypt existants; contrôles d’accès dans actions serveur et API.
- API mobile : routes JSON `/api/v1`; Expo/React Native reste le client mobile.
- E-mails : intégration existante Nodemailer/providers configurés; rapports PDF via `@react-pdf/renderer`; IA existante dans `src/lib/ai.ts`; tâches planifiées via Docker/cron.

Ne pas ajouter un second backend cloud. Les fonctionnalités du cahier des charges doivent s’intégrer à ces briques ou être justifiées par un besoin manquant mesuré.
