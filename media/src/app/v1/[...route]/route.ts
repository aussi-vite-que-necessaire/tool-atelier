import { handleV1 } from "@/lib/v1/router";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => handleV1(req);
export const DELETE = (req: Request) => handleV1(req);
