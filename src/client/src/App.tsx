import { NomadProvider, useNomad } from './contexts/NomadContext';
import { Route, Switch } from 'wouter';
import Landing from './pages/Landing';
import PlanningForm from './pages/PlanningForm';
import ReviewItinerary from './pages/ReviewItinerary';
import ItineraryView from './pages/ItineraryView';
import { NotificationStack } from './components/NotificationStack';

function AppContent() {
  const { notifications, dismissNotification } = useNomad();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fdf9f7' }}>
      <Switch>
        <Route path="/" component={Landing} />
          <Route path="/plan" component={PlanningForm} />
          <Route path="/review" component={ReviewItinerary} />
          <Route path="/live" component={ItineraryView} />
          <Route component={Landing} />
      </Switch>

      <NotificationStack
        notifications={notifications}
        onDismiss={dismissNotification}
      />
    </div>
  );
}

export default function App() {
  return (
    <NomadProvider>
      <AppContent />
    </NomadProvider>
  );
}
