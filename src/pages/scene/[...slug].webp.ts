import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { SCENES, sceneSvg, type SceneId } from '../../lib/scenes';

/**
 * Растрирование сцен в WebP на сборке.
 *
 * Почему не инлайновый SVG, как чертежи. Сцена — это градиенты, размытия
 * и зерно: в разметке она весила бы десятки килобайт на страницу и считалась
 * бы браузером при каждой отрисовке. Растр грузится лениво, кэшируется по
 * имени файла и ведёт себя как фотография — обрезается по контейнеру.
 *
 * Две ширины на сцену: узкая для телефона, широкая для десктопа и плотных
 * экранов. Больше не нужно — при трёх ширинах выигрыш уже в пределах
 * погрешности, а сборка удваивается.
 */

const WIDTHS = [900, 1800] as const;

export const getStaticPaths = (async () =>
  (Object.keys(SCENES) as SceneId[]).flatMap((id) =>
    WIDTHS.map((w) => ({ params: { slug: `${id}-${w}` }, props: { id, w } })),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { id, w } = props as { id: SceneId; w: number };
  const svg = sceneSvg(id);
  const png = await sharp(Buffer.from(svg), { density: 96 })
    .resize({ width: w })
    .webp({ quality: 82, effort: 5 })
    .toBuffer();
  return new Response(png, {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
