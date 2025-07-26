import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Container, Box, Tabs, Tab } from '@mui/material';
import LoanManagement from './components/LoanManagement';
// import OtherProblems from './components/OtherProblems'; // <-- THIS LINE IS REMOVED
import './App.css'; // For any custom global styles

function App() {
  // Since there's only one tab now, we can simplify this or keep it at 0
  const [tabValue, setTabValue] = useState(0);

  const handleChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Bank Lending System {/* Simplified title */}
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleChange} aria-label="main tabs">
            <Tab label="Bank Lending System" />
            {/* <Tab label="Other Problems" /> <-- THIS LINE IS REMOVED */}
          </Tabs>
        </Box>
        {tabValue === 0 && <LoanManagement />}
        {/* {tabValue === 1 && <OtherProblems />} <-- THIS LINE IS REMOVED */}
      </Container>
    </Box>
  );
}

export default App;