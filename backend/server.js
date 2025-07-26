// backend/server.js - MODIFIED FOR POSTGRESQL
const express = require('express');
const cors = require('cors');
const db = require('./database'); // Our PostgreSQL database connection pool
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs
const app = express();
const PORT = process.env.PORT || 5000; // Use process.env.PORT for Render/Railway

// Middleware
app.use(cors());
app.use(express.json()); // To parse JSON request bodies

// --- Helper Functions (Calculations) ---
const calculateLoanDetails = (principal, years, rate) => {
    const interest = principal * years * (rate / 100);
    const totalAmount = principal + interest;
    const monthlyEmi = totalAmount / (years * 12);
    return { totalAmount, monthlyEmi, interest };
};

// --- API Endpoints for Bank Lending System ---

// 2.1. LEND: Create a new loan
app.post('/api/v1/loans', async (req, res) => { // Use async/await for db queries
    const { customer_id, loan_amount, loan_period_years, interest_rate_yearly } = req.body;

    if (!customer_id || !loan_amount || !loan_period_years || !interest_rate_yearly) {
        return res.status(400).json({ message: 'Missing required loan parameters.' });
    }
    if (loan_amount <= 0 || loan_period_years <= 0 || interest_rate_yearly < 0) {
        return res.status(400).json({ message: 'Invalid input for loan parameters.' });
    }

    try {
        // Check if customer exists and insert if not.
        // Using parameterized queries ($1, $2, etc.) for PostgreSQL
        let customerCheck = await db.query('SELECT customer_id FROM Customers WHERE customer_id = $1', [customer_id]);
        if (customerCheck.rows.length === 0) {
            await db.query('INSERT INTO Customers (customer_id, name) VALUES ($1, $2)', [customer_id, `Customer ${customer_id}`]);
        }

        const loan_id = uuidv4();
        const { totalAmount, monthlyEmi, interest } = calculateLoanDetails(loan_amount, loan_period_years, interest_rate_yearly);

        await db.query(
            `INSERT INTO Loans (loan_id, customer_id, principal_amount, total_amount, interest_rate, loan_period_years, monthly_emi, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [loan_id, customer_id, loan_amount, totalAmount, interest_rate_yearly, loan_period_years, monthlyEmi, 'ACTIVE']
        );

        res.status(201).json({
            loan_id: loan_id,
            customer_id: customer_id,
            total_amount_payable: totalAmount,
            monthly_emi: monthlyEmi,
            total_interest: interest
        });
    } catch (err) {
        console.error('Error creating loan:', err.message);
        res.status(500).json({ message: 'Error creating loan.', error: err.message });
    }
});

// 2.2. PAYMENT: Record a payment for a loan
app.post('/api/v1/loans/:loan_id/payments', async (req, res) => {
    const { loan_id } = req.params;
    const { amount, payment_type } = req.body;

    if (!amount || !payment_type || (payment_type !== 'EMI' && payment_type !== 'LUMP_SUM')) {
        return res.status(400).json({ message: 'Missing or invalid payment parameters.' });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: 'Payment amount must be positive.' });
    }

    let client; // Used for transaction management
    try {
        // Start a database transaction for atomicity (all or nothing)
        await db.query('BEGIN'); 

        // Get loan details and lock the row FOR UPDATE to prevent race conditions during payment
        const loanResult = await db.query('SELECT * FROM Loans WHERE loan_id = $1 FOR UPDATE', [loan_id]); 
        const loan = loanResult.rows[0]; // Get the first (and only) row

        if (!loan) {
            await db.query('ROLLBACK'); // Rollback if loan not found
            return res.status(404).json({ message: 'Loan not found.' });
        }
        if (loan.status === 'PAID_OFF') {
            await db.query('ROLLBACK'); // Rollback if loan already paid off
            return res.status(400).json({ message: 'Loan is already paid off.' });
        }

        const newPaymentId = uuidv4();
        const totalInterestCalculated = parseFloat(loan.principal_amount) * parseFloat(loan.loan_period_years) * (parseFloat(loan.interest_rate) / 100);
        const originalTotalAmount = parseFloat(loan.principal_amount) + totalInterestCalculated;

        // Get sum of previous payments
        const paymentsResult = await db.query('SELECT amount FROM Payments WHERE loan_id = $1', [loan_id]);
        const amountPaidTillDate = paymentsResult.rows.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        let remainingBalance = originalTotalAmount - amountPaidTillDate - amount;
        let newStatus = loan.status;
        if (remainingBalance <= 0) {
            remainingBalance = 0;
            newStatus = 'PAID_OFF';
        }

        let emisLeft = 0;
        if (parseFloat(loan.monthly_emi) > 0) {
            emisLeft = Math.ceil(Math.max(0, remainingBalance) / parseFloat(loan.monthly_emi));
        }

        // Record the new payment
        await db.query(
            `INSERT INTO Payments (payment_id, loan_id, amount, payment_type, payment_date) VALUES ($1, $2, $3, $4, NOW())`,
            [newPaymentId, loan_id, amount, payment_type]
        );

        // Update the loan status
        await db.query(`UPDATE Loans SET status = $1 WHERE loan_id = $2`, [newStatus, loan_id]);

        await db.query('COMMIT'); // Commit the transaction

        res.status(200).json({
            payment_id: newPaymentId,
            loan_id: loan_id,
            message: `Payment recorded successfully. Loan status: ${newStatus}`,
            remaining_balance: remainingBalance,
            emis_left: emisLeft
        });
    } catch (err) {
        // If any error occurs, attempt to rollback the transaction
        await db.query('ROLLBACK');
        console.error('Error recording payment:', err.message);
        res.status(500).json({ message: 'Error recording payment.', error: err.message });
    }
});

// 2.3. LEDGER: View loan details and transaction history
app.get('/api/v1/loans/:loan_id/ledger', async (req, res) => {
    const { loan_id } = req.params;

    try {
        const loanResult = await db.query('SELECT * FROM Loans WHERE loan_id = $1', [loan_id]);
        const loan = loanResult.rows[0];

        if (!loan) {
            return res.status(404).json({ message: 'Loan not found.' });
        }

        const transactionsResult = await db.query(
            'SELECT payment_id AS transaction_id, payment_date AS date, amount, payment_type AS type FROM Payments WHERE loan_id = $1 ORDER BY payment_date ASC',
            [loan_id]
        );
        const transactions = transactionsResult.rows;

        const totalInterestCalculated = parseFloat(loan.principal_amount) * parseFloat(loan.loan_period_years) * (parseFloat(loan.interest_rate) / 100);
        const originalTotalAmount = parseFloat(loan.principal_amount) + totalInterestCalculated;
        const amountPaid = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const balanceAmount = originalTotalAmount - amountPaid;

        let emisLeft = 0;
        if (parseFloat(loan.monthly_emi) > 0) {
            emisLeft = Math.ceil(Math.max(0, balanceAmount) / parseFloat(loan.monthly_emi));
        }

        res.status(200).json({
            loan_id: loan.loan_id,
            customer_id: loan.customer_id,
            principal: parseFloat(loan.principal_amount),
            total_amount: originalTotalAmount,
            monthly_emi: parseFloat(loan.monthly_emi),
            amount_paid: amountPaid,
            balance_amount: balanceAmount,
            emis_left: emisLeft,
            status: loan.status,
            transactions: transactions
        });
    } catch (err) {
        console.error('Error fetching ledger:', err.message);
        res.status(500).json({ message: 'Error fetching ledger.', error: err.message });
    }
});

// 2.4. ACCOUNT OVERVIEW: View all loans for a customer
app.get('/api/v1/customers/:customer_id/overview', async (req, res) => {
    const { customer_id } = req.params;

    try {
        const loansResult = await db.query('SELECT * FROM Loans WHERE customer_id = $1', [customer_id]);
        const loans = loansResult.rows;

        if (!loans || loans.length === 0) {
            return res.status(404).json({ message: 'Customer or loans for this customer not found.' });
        }

        const resolvedLoans = await Promise.all(loans.map(async (loan) => {
            const paymentsResult = await db.query('SELECT amount FROM Payments WHERE loan_id = $1', [loan.loan_id]);
            const amountPaid = paymentsResult.rows.reduce((sum, p) => sum + parseFloat(p.amount), 0);

            const totalInterest = parseFloat(loan.principal_amount) * parseFloat(loan.loan_period_years) * (parseFloat(loan.interest_rate) / 100);
            const totalAmountPayable = parseFloat(loan.principal_amount) + totalInterest;
            const balanceAmount = totalAmountPayable - amountPaid;

            let emisLeft = 0;
            if (parseFloat(loan.monthly_emi) > 0) {
                emisLeft = Math.ceil(Math.max(0, balanceAmount) / parseFloat(loan.monthly_emi));
            }

            return {
                loan_id: loan.loan_id,
                principal: parseFloat(loan.principal_amount),
                total_amount: totalAmountPayable,
                total_interest: totalInterest,
                emi_amount: parseFloat(loan.monthly_emi),
                amount_paid: amountPaid,
                emis_left: emisLeft,
                status: loan.status
            };
        }));

        res.status(200).json({
            customer_id: customer_id,
            total_loans: resolvedLoans.length,
            loans: resolvedLoans
        });
    } catch (err) {
        console.error('Error fetching customer overview:', err.message);
        res.status(500).json({ message: 'Error processing customer overview.', error: err.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});