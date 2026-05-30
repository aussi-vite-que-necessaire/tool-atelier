import { redirect } from 'next/navigation';

// /ressources/r n'a pas de vue propre : la liste des ressources vit sur la
// bibliothèque. On y renvoie.
export default function ResourcesIndexRedirect() {
  redirect('/ressources');
}
