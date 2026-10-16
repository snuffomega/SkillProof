import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SkillProofDB } from '@/data/db';
import { createDexieRepository } from '@/data/dexie-repository';
import { RepositoryProvider } from '@/data/hooks';
import { seedDemo } from '@/data/seed';
import App from './App';
import './index.css';

const repository = createDexieRepository(new SkillProofDB());

async function bootstrap() {
  const seeded = await repository.getSetting('seededAt');
  if (!seeded && (await repository.listSkills()).length === 0) await seedDemo(repository);
}

bootstrap()
  .catch((e) => console.error('Failed to load demo workspace', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <RepositoryProvider repository={repository}>
          <App />
        </RepositoryProvider>
      </StrictMode>,
    );
  });
