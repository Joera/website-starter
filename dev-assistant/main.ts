import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import { MainController } from './main.ctrlr';
import { clearFolder } from './fs';
import { downloadHTML } from './ipfs';

const app: Express = express();
const PORT = process.env.PORT || 3000;

function extractLogs(errorString: string): string[] {
  const jsonMatch = errorString.match(/Response from the nodes: ({.+})/s);
  
  if (!jsonMatch) return [];
  
  try {
    const errorData = JSON.parse(jsonMatch[1]);
    const logs = errorData.error?.logs || '';
    return logs.split('\n').filter((line: string) => line.trim().length > 0);
  } catch (e) {
    console.error('Failed to extract logs:', e);
    return [];
  }
}


const ctrlr = new MainController();
ctrlr.init()

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});



// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Server is running' });
});

app.post('/', async (req: Request, res: Response) => {

    const STREAM_IDS = [
        "34181876520727506972927557866018337454821455712420252335586679347441041426936",
    ];
    const publication = "block001.soul2soul.eth";
    const authorSafeAddress = "0x04660132323Fe65C5BaF9107Cfe8a941386b4EAF";
    
    const { config, cid: configCid } = await ctrlr.renewConfig(publication);

    try {

        const action: any = await ctrlr.runAction(authorSafeAddress, publication, STREAM_IDS, configCid);
        res.json({ logs: action.logs, response: action.response });

    } catch(error: any) {

        const logs = extractLogs(error.message || error.toString());

        res.json(logs)

    }

    // console.log(action.logs)
    // console.log(action.response)

    //  const response = JSON.parse(action.response);

    // console.log("res", response)

    // if (response.cborRootCid) {
    //   const folder = "../html";
    //   clearFolder(folder);
    //   await downloadHTML(response.cborRootCid, folder);
    // }
    
    
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});



// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;