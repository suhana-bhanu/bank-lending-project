// frontend/src/components/LoanManagement.js
import React, { useState } from 'react';
import {
    Box,
    Typography,
    TextField,
    Button,
    Grid,
    Paper,
    Alert,
    CircularProgress,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api/v1';

const LoanManagement = () => {
    const [lendData, setLendData] = useState({ customer_id: '', loan_amount: '', loan_period_years: '', interest_rate_yearly: '' });
    const [paymentData, setPaymentData] = useState({ loan_id: '', amount: '', payment_type: 'EMI' });
    const [ledgerLoanId, setLedgerLoanId] = useState('');
    const [customerOverviewId, setCustomerOverviewId] = useState('');

    const [message, setMessage] = useState('');
    const [severity, setSeverity] = useState('info');
    const [loading, setLoading] = useState(false);

    const [ledgerDetails, setLedgerDetails] = useState(null);
    const [customerOverview, setCustomerOverview] = useState(null);

    const handleLendChange = (e) => {
        setLendData({ ...lendData, [e.target.name]: e.target.value });
    };

    const handlePaymentChange = (e) => {
        setPaymentData({ ...paymentData, [e.target.name]: e.target.value });
    };

    const showAlert = (msg, type) => {
        setMessage(msg);
        setSeverity(type);
        setTimeout(() => setMessage(''), 5000); // Clear message after 5 seconds
    };

    const handleLendSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/loans`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...lendData,
                    loan_amount: parseFloat(lendData.loan_amount),
                    loan_period_years: parseInt(lendData.loan_period_years),
                    interest_rate_yearly: parseFloat(lendData.interest_rate_yearly)
                }),
            });
            const data = await response.json();
            if (response.ok) {
                showAlert('Loan created successfully! Loan ID: ' + data.loan_id, 'success');
                setLendData({ customer_id: '', loan_amount: '', loan_period_years: '', interest_rate_yearly: '' });
            } else {
                showAlert('Error creating loan: ' + data.message, 'error');
            }
        } catch (error) {
            showAlert('Network error: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/loans/${paymentData.loan_id}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: parseFloat(paymentData.amount),
                    payment_type: paymentData.payment_type
                }),
            });
            const data = await response.json();
            if (response.ok) {
                showAlert('Payment recorded successfully! Remaining balance: ' + data.remaining_balance.toFixed(2), 'success');
                setPaymentData({ loan_id: '', amount: '', payment_type: 'EMI' });
            } else {
                showAlert('Error recording payment: ' + data.message, 'error');
            }
        } catch (error) {
            showAlert('Network error: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleGetLedger = async (e) => {
        e.preventDefault();
        setLoading(true);
        setLedgerDetails(null);
        try {
            const response = await fetch(`${API_BASE_URL}/loans/${ledgerLoanId}/ledger`);
            const data = await response.json();
            if (response.ok) {
                setLedgerDetails(data);
                showAlert('Ledger loaded successfully!', 'success');
            } else {
                showAlert('Error fetching ledger: ' + data.message, 'error');
            }
        } catch (error) {
            showAlert('Network error: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleGetCustomerOverview = async (e) => {
        e.preventDefault();
        setLoading(true);
        setCustomerOverview(null);
        try {
            const response = await fetch(`${API_BASE_URL}/customers/${customerOverviewId}/overview`);
            const data = await response.json();
            if (response.ok) {
                setCustomerOverview(data);
                showAlert('Customer overview loaded successfully!', 'success');
            } else {
                showAlert('Error fetching customer overview: ' + data.message, 'error');
            }
        } catch (error) {
            showAlert('Network error: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ mt: 4 }}>
            {message && <Alert severity={severity} sx={{ mb: 2 }}>{message}</Alert>}
            {loading && <CircularProgress sx={{ display: 'block', mx: 'auto', mb: 2 }} />}

            {/* LEND Section */}
            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="h6">1. Create New Loan (LEND)</Typography></AccordionSummary>
                <AccordionDetails>
                    <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                        <form onSubmit={handleLendSubmit}>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}><TextField label="Customer ID" name="customer_id" value={lendData.customer_id} onChange={handleLendChange} fullWidth required /></Grid>
                                <Grid item xs={12} sm={6}><TextField label="Loan Amount (P)" name="loan_amount" type="number" value={lendData.loan_amount} onChange={handleLendChange} fullWidth required inputProps={{ step: "0.01" }} /></Grid>
                                <Grid item xs={12} sm={6}><TextField label="Loan Period (Years - N)" name="loan_period_years" type="number" value={lendData.loan_period_years} onChange={handleLendChange} fullWidth required inputProps={{ min: 1 }} /></Grid>
                                <Grid item xs={12} sm={6}><TextField label="Interest Rate (Yearly - R)" name="interest_rate_yearly" type="number" value={lendData.interest_rate_yearly} onChange={handleLendChange} fullWidth required inputProps={{ step: "0.01", min: 0 }} /></Grid>
                                <Grid item xs={12}><Button type="submit" variant="contained" color="primary" fullWidth disabled={loading}>Create Loan</Button></Grid>
                            </Grid>
                        </form>
                    </Paper>
                </AccordionDetails>
            </Accordion>

            {/* PAYMENT Section */}
            <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="h6">2. Record Payment (PAYMENT)</Typography></AccordionSummary>
                <AccordionDetails>
                    <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                        <form onSubmit={handlePaymentSubmit}>
                            <Grid container spacing={2}>
                                <Grid item xs={12}><TextField label="Loan ID" name="loan_id" value={paymentData.loan_id} onChange={handlePaymentChange} fullWidth required /></Grid>
                                <Grid item xs={12} sm={6}><TextField label="Payment Amount" name="amount" type="number" value={paymentData.amount} onChange={handlePaymentChange} fullWidth required inputProps={{ step: "0.01" }} /></Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        select
                                        label="Payment Type"
                                        name="payment_type"
                                        value={paymentData.payment_type}
                                        onChange={handlePaymentChange}
                                        fullWidth
                                        required
                                        SelectProps={{ native: true }}
                                    >
                                        <option value="EMI">EMI</option>
                                        <option value="LUMP_SUM">LUMP SUM</option>
                                    </TextField>
                                </Grid>
                                <Grid item xs={12}><Button type="submit" variant="contained" color="primary" fullWidth disabled={loading}>Record Payment</Button></Grid>
                            </Grid>
                        </form>
                    </Paper>
                </AccordionDetails>
            </Accordion>

            {/* LEDGER Section */}
            <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="h6">3. View Loan Ledger (LEDGER)</Typography></AccordionSummary>
                <AccordionDetails>
                    <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                        <form onSubmit={handleGetLedger}>
                            <Grid container spacing={2}>
                                <Grid item xs={12}><TextField label="Loan ID" value={ledgerLoanId} onChange={(e) => setLedgerLoanId(e.target.value)} fullWidth required /></Grid>
                                <Grid item xs={12}><Button type="submit" variant="contained" color="secondary" fullWidth disabled={loading}>Get Ledger</Button></Grid>
                            </Grid>
                        </form>

                        {ledgerDetails && (
                            <Box sx={{ mt: 3 }}>
                                <Typography variant="h6">Loan Details for {ledgerDetails.loan_id}</Typography>
                                <TableContainer component={Paper} sx={{ mt: 2 }}>
                                    <Table size="small">
                                        <TableBody>
                                            <TableRow><TableCell>Customer ID</TableCell><TableCell>{ledgerDetails.customer_id}</TableCell></TableRow>
                                            <TableRow><TableCell>Principal Amount</TableCell><TableCell>{ledgerDetails.principal.toFixed(2)}</TableCell></TableRow>
                                            <TableRow><TableCell>Total Amount Payable</TableCell><TableCell>{ledgerDetails.total_amount.toFixed(2)}</TableCell></TableRow>
                                            <TableRow><TableCell>Monthly EMI</TableCell><TableCell>{ledgerDetails.monthly_emi.toFixed(2)}</TableCell></TableRow>
                                            <TableRow><TableCell>Amount Paid</TableCell><TableCell>{ledgerDetails.amount_paid.toFixed(2)}</TableCell></TableRow>
                                            <TableRow><TableCell>Balance Amount</TableCell><TableCell>{ledgerDetails.balance_amount.toFixed(2)}</TableCell></TableRow>
                                            <TableRow><TableCell>EMIs Left</TableCell><TableCell>{ledgerDetails.emis_left}</TableCell></TableRow>
                                            <TableRow><TableCell>Status</TableCell><TableCell>{ledgerDetails.status}</TableCell></TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>

                                <Typography variant="h6" sx={{ mt: 3 }}>Transaction History</Typography>
                                {ledgerDetails.transactions.length > 0 ? (
                                    <TableContainer component={Paper} sx={{ mt: 2 }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Transaction ID</TableCell>
                                                    <TableCell>Date</TableCell>
                                                    <TableCell>Amount</TableCell>
                                                    <TableCell>Type</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {ledgerDetails.transactions.map((t) => (
                                                    <TableRow key={t.transaction_id}>
                                                        <TableCell>{t.transaction_id}</TableCell>
                                                        <TableCell>{new Date(t.date).toLocaleString()}</TableCell>
                                                        <TableCell>{t.amount.toFixed(2)}</TableCell>
                                                        <TableCell>{t.type}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                ) : (
                                    <Typography sx={{ mt: 1 }}>No transactions recorded for this loan.</Typography>
                                )}
                            </Box>
                        )}
                    </Paper>
                </AccordionDetails>
            </Accordion>

            {/* ACCOUNT OVERVIEW Section */}
            <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="h6">4. View Customer Account Overview</Typography></AccordionSummary>
                <AccordionDetails>
                    <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                        <form onSubmit={handleGetCustomerOverview}>
                            <Grid container spacing={2}>
                                <Grid item xs={12}><TextField label="Customer ID" value={customerOverviewId} onChange={(e) => setCustomerOverviewId(e.target.value)} fullWidth required /></Grid>
                                <Grid item xs={12}><Button type="submit" variant="contained" color="secondary" fullWidth disabled={loading}>Get Account Overview</Button></Grid>
                            </Grid>
                        </form>

                        {customerOverview && (
                            <Box sx={{ mt: 3 }}>
                                <Typography variant="h6">Overview for Customer ID: {customerOverview.customer_id} ({customerOverview.total_loans} loans)</Typography>
                                {customerOverview.loans.length > 0 ? (
                                    <TableContainer component={Paper} sx={{ mt: 2 }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Loan ID</TableCell>
                                                    <TableCell>Principal</TableCell>
                                                    <TableCell>Total Amount</TableCell>
                                                    <TableCell>Total Interest</TableCell>
                                                    <TableCell>EMI Amount</TableCell>
                                                    <TableCell>Amount Paid</TableCell>
                                                    <TableCell>EMIs Left</TableCell>
                                                    <TableCell>Status</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {customerOverview.loans.map((loan) => (
                                                    <TableRow key={loan.loan_id}>
                                                        <TableCell>{loan.loan_id}</TableCell>
                                                        <TableCell>{loan.principal.toFixed(2)}</TableCell>
                                                        <TableCell>{loan.total_amount.toFixed(2)}</TableCell>
                                                        <TableCell>{loan.total_interest.toFixed(2)}</TableCell>
                                                        <TableCell>{loan.emi_amount.toFixed(2)}</TableCell>
                                                        <TableCell>{loan.amount_paid.toFixed(2)}</TableCell>
                                                        <TableCell>{loan.emis_left}</TableCell>
                                                        <TableCell>{loan.status}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                ) : (
                                    <Typography sx={{ mt: 1 }}>No loans found for this customer.</Typography>
                                )}
                            </Box>
                        )}
                    </Paper>
                </AccordionDetails>
            </Accordion>
        </Box>
    );
};

export default LoanManagement;