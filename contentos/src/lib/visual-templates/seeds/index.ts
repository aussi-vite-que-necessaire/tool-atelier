import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';
import { linkedinBannerStat } from './linkedin-banner-stat';
import { linkedinBigNumber } from './linkedin-big-number';
import { linkedinCodeWindow } from './linkedin-code-window';
import { linkedinCommand } from './linkedin-command';
import { linkedinFeatureImage } from './linkedin-feature-image';
import { linkedinHorizontal } from './linkedin-horizontal';
import { linkedinManifesto } from './linkedin-manifesto';
import { linkedinPhotoCard } from './linkedin-photo-card';
import { linkedinPoster } from './linkedin-poster';
import { linkedinProcess } from './linkedin-process';
import { linkedinStack } from './linkedin-stack';
import { linkedinVertical } from './linkedin-vertical';

export const VISUAL_TEMPLATE_SEEDS: CreateVisualTemplateInput[] = [
  linkedinBigNumber,
  linkedinManifesto,
  linkedinPhotoCard,
  linkedinBannerStat,
  linkedinCodeWindow,
  linkedinCommand,
  linkedinFeatureImage,
  linkedinHorizontal,
  linkedinPoster,
  linkedinProcess,
  linkedinStack,
  linkedinVertical,
];
