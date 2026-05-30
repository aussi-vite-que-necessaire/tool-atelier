import { redirect } from 'next/navigation';

// La section media s'ouvre sur la galerie.
export default function MediaPage() {
  redirect('/media/gallery');
}
