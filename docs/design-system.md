# Design system — QSCHOOL

## Référence

Source : `charte graphique.pdf`, identité Quoreich Group, pages 2–4.
La charte prescrit deux couleurs, Montserrat et Playfair Display, et montre
les variantes couleur et monochrome du logo. Les règles d'interface ci-dessous
sont des adaptations proposées pour QSCHOOL, pas des prescriptions du PDF.
Utiliser les fichiers originaux du logo ;
ne pas le recréer avec du texte ni extraire une capture basse résolution.

## Couleurs

| Rôle | Valeur | Usage |
| --- | --- | --- |
| Marque principale | `#0062DB` | Actions principales, liens, sélection |
| Accent de marque | `#FF8A51` | Accents, illustrations, fonds avec texte sombre |
| Texte | `#172033` | Contenu et libellés |
| Surface | `#FFFFFF` | Cartes, formulaires |
| Fond | `#F5F8FC` | Arrière-plan de l'application |

Les neutres et couleurs de statut sont des extensions fonctionnelles.
Ne pas utiliser du texte blanc sur l'orange de marque ni de petits textes
orange sur blanc. Conserver un libellé ou une icône pour distinguer les statuts.
Le focus clavier doit rester visible sur toutes les surfaces.

## Typographie

- **Montserrat** : navigation, formulaires, tableaux, titres de pages fonctionnelles.
- **Playfair Display** : titres éditoriaux, accueil et éléments institutionnels ;
  classe `font-heading`, jamais pour les tableaux denses.
- Texte courant : 16 px minimum ; libellés secondaires : 14 px ; interligne 1,5–1,65.
- Titres : 24/32/40 px selon la hiérarchie ; limiter les capitales aux petits labels.

## Composants et dispositions

- Espacements : 4, 8, 12, 16, 24, 32, 48 px ; rayon de base : 10 px.
- Bouton principal bleu avec texte blanc ; secondaire sobre ; suppression rouge.
- Prévoir les états focus, survol, désactivé, chargement, erreur et succès.
- Formulaires : libellés persistants, erreurs à côté du champ, indication des champs requis.
- Mobile : cibles tactiles d'au moins 44 × 44 unités, marges de 16, navigation par rôle.
- Présenter les tableaux larges sous forme de listes/cartes sur petit écran.

## Implémentation et partage

Les couleurs primitives et dimensions sont dans `src/design-system/tokens.json`.
Le thème web est exposé via les variables sémantiques de `src/app/globals.css`.
Les nouveaux composants doivent utiliser `bg-primary`, `text-foreground`,
`bg-card`, `border-border`, etc. Les anciennes couleurs codées en dur devront
être remplacées au fil de la refonte des écrans.

La future app Expo pourra importer le JSON et charger les mêmes polices avec
les noms enregistrés côté natif. Les composants HTML/shadcn ne sont pas
réutilisables directement dans React Native. Le thème sombre est une adaptation
fonctionnelle ; il devra être vérifié écran par écran avant sa mise en service.
