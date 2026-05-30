import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getSkill, getSkillDirAsync } from './catalog';

// Archive ZIP « stored » (sans compression) construite en mémoire — pas de
// dépendance binaire. Un skill ne pèse que quelques Ko de markdown : la
// compression n'apporte rien et un writer minimal évite jszip/archiver.

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xff_ff_ff_ff;
  // L'index est masqué à 0–255 : la table de 256 entrées le couvre toujours.
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}

type Entry = { name: string; data: Buffer };

// Liste récursive des fichiers d'un dossier, chemins relatifs en avant-slash.
async function collect(absDir: string, prefix: string): Promise<Entry[]> {
  const out: Entry[] = [];
  for (const e of await fs.readdir(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, e.name);
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await collect(abs, rel)));
    else if (e.isFile()) out.push({ name: rel, data: await fs.readFile(abs) });
  }
  return out;
}

function buildZip(entries: Entry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04_03_4b_50, 0); // signature locale PK\x03\x04
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: 0 = stored
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    nameBuf.copy(local, 30);
    locals.push(local, data);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02_01_4b_50, 0); // signature centrale PK\x01\x02
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // method
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // offset du local header
    nameBuf.copy(central, 46);
    centrals.push(central);

    offset += local.length + data.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const localBuf = Buffer.concat(locals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06_05_4b_50, 0); // End of central directory PK\x05\x06
  end.writeUInt16LE(0, 4); // disk
  end.writeUInt16LE(0, 6); // disk with central dir
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(localBuf.length, 16); // offset du central directory
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localBuf, centralBuf, end]);
}

// Construit l'archive ZIP d'un skill (fichiers préfixés par le nom du skill).
// Renvoie null si le skill est inconnu.
export async function skillArchive(name: string): Promise<Buffer | null> {
  const manifest = await getSkill(name);
  if (!manifest) return null;
  const dir = await getSkillDirAsync(name);
  const entries = await collect(dir, name);
  return buildZip(entries);
}
