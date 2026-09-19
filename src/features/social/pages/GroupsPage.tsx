import { SocialPage } from '../components/SocialPage';
import { GroupPanel } from '../components/GroupPanel';

export function GroupsPage() {
  return (
    <SocialPage title="Groupes" subtitle="Tes tablées, leurs discussions, et les codes pour y entrer.">
      <GroupPanel />
    </SocialPage>
  );
}
