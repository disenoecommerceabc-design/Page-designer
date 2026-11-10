import { resourceFile } from "../../../lib/builder/store";
export async function GET(request:Request,context:{params:Promise<{file:string}>}){return resourceFile(request,(await context.params).file,true);}
