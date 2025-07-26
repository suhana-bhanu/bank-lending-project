// backend/server.js
const express = require('express');
const cors = require('cors');
const db = require('./database'); // Our SQLite database connection
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs
const app = express();
const PORT = 5000;

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
app.post('/api/v1/loans', (req, res) => {
    const { customer_id, loan_amount, loan_period_years, interest_rate_yearly } = req.body;

    if (!customer_id || !loan_amount || !loan_period_years || !interest_rate_yearly) {
        return res.status(400).json({ message: 'Missing required loan parameters.' });
    }

    if (loan_amount <= 0 || loan_period_years <= 0 || interest_rate_yearly < 0) {
        return res.status(400).json({ message: 'Invalid input for loan parameters.' });
    }

    // Ensure customer exists or create a placeholder for simplicity (in a real system, customers would be managed separately)
    db.get('SELECT customer_id FROM Customers WHERE customer_id = ?', [customer_id], (err, row) => {
        if (err) {
            return res.status(500).json({ message: 'Database error.', error: err.message });
        }
        if (!row) {
            // If customer doesn't exist, insert a placeholder (e.g., 'Unknown Customer')
            db.run('INSERT INTO Customers (customer_id, name) VALUES (?, ?)', [customer_id, `Customer ${customer_id}`], (err) => {
                if (err) {
                    console.error('Error inserting new customer:', err.message);
                    // Continue even if placeholder insertion fails, as loan creation might still proceed
                }
            });
        }

        const loan_id = uuidv4();
        const { totalAmount, monthlyEmi, interest } = calculateLoanDetails(loan_amount, loan_period_years, interest_rate_yearly);

        db.run(
            `INSERT INTO Loans (loan_id, customer_id, principal_amount, total_amount, interest_rate, loan_period_years, monthly_emi)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [loan_id, customer_id, loan_amount, totalAmount, interest_rate_yearly, loan_period_years, monthlyEmi],
            function (err) {
                if (err) {
                    return res.status(500).json({ message: 'Error creating loan.', error: err.message });
                }
                res.status(201).json({
                    loan_id: loan_id,
                    customer_id: customer_id,
                    total_amount_payable: totalAmount,
                    monthly_emi: monthlyEmi,
                    total_interest: interest // Added for clarity, though not explicitly in success response
                });
            }
        );
    });
});

// 2.2. PAYMENT: Record a payment for a loan
app.post('/api/v1/loans/:loan_id/payments', (req, res) => {
    const { loan_id } = req.params;
    const { amount, payment_type } = req.body;

    if (!amount || !payment_type || (payment_type !== 'EMI' && payment_type !== 'LUMP_SUM')) {
        return res.status(400).json({ message: 'Missing or invalid payment parameters.' });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: 'Payment amount must be positive.' });
    }

    db.get('SELECT * FROM Loans WHERE loan_id = ?', [loan_id], (err, loan) => {
        if (err) {
            return res.status(500).json({ message: 'Database error.', error: err.message });
        }
        if (!loan) {
            return res.status(404).json({ message: 'Loan not found.' });
        }
        if (loan.status === 'PAID_OFF') {
             return res.status(400).json({ message: 'Loan is already paid off.' });
        }

        const newPaymentId = uuidv4();
        const originalTotalAmount = loan.principal_amount + (loan.principal_amount * loan.loan_period_years * (loan.interest_rate / 100));
        let amountPaidTillDate = 0;

        // First, sum up all previous payments for this loan
        db.all('SELECT amount FROM Payments WHERE loan_id = ?', [loan_id], (err, payments) => {
            if (err) {
                return res.status(500).json({ message: 'Error fetching previous payments.', error: err.message });
            }
            amountPaidTillDate = payments.reduce((sum, p) => sum + p.amount, 0);

            let remainingBalance = originalTotalAmount - amountPaidTillDate - amount;

            let newStatus = loan.status;
            if (remainingBalance <= 0) {
                remainingBalance = 0; // Ensure balance doesn't go negative
                newStatus = 'PAID_OFF';
            }

            // Recalculate EMIs left for LUMP_SUM payments
            let emisLeft = null;
            if (payment_type === 'LUMP_SUM' && loan.monthly_emi > 0) {
                emisLeft = Math.ceil(remainingBalance / loan.monthly_emi);
            } else if (loan.monthly_emi > 0) { // For EMI payments, it's just a reduction
                emisLeft = Math.ceil(remainingBalance / loan.monthly_emi); // Still recalculate based on balance
            } else {
                emisLeft = 0; // If EMI is 0 (e.g., if loan_amount was 0 or already paid off)
            }


            db.serialize(() => {
                db.run('BEGIN TRANSACTION;');

                // Record the new payment
                db.run(
                    `INSERT INTO Payments (payment_id, loan_id, amount, payment_type) VALUES (?, ?, ?, ?)`,
                    [newPaymentId, loan_id, amount, payment_type],
                    function (err) {
                        if (err) {
                            db.run('ROLLBACK;');
                            return res.status(500).json({ message: 'Error recording payment.', error: err.message });
                        }

                        // Update the loan status if paid off
                        db.run(
                            `UPDATE Loans SET status = ? WHERE loan_id = ?`,
                            [newStatus, loan_id],
                            function (err) {
                                if (err) {
                                    db.run('ROLLBACK;');
                                    return res.status(500).json({ message: 'Error updating loan status.', error: err.message });
                                }
                                db.run('COMMIT;');
                                res.status(200).json({
                                    payment_id: newPaymentId,
                                    loan_id: loan_id,
                                    message: `Payment recorded successfully. Loan status: ${newStatus}`,
                                    remaining_balance: remainingBalance,
                                    emis_left: emisLeft
                                });
                            }
                        );
                    }
                );
            });
        });
    });
});


// 2.3. LEDGER: View loan details and transaction history
app.get('/api/v1/loans/:loan_id/ledger', (req, res) => {
    const { loan_id } = req.params;

    db.get('SELECT * FROM Loans WHERE loan_id = ?', [loan_id], (err, loan) => {
        if (err) {
            return res.status(500).json({ message: 'Database error.', error: err.message });
        }
        if (!loan) {
            return res.status(404).json({ message: 'Loan not found.' });
        }

        db.all('SELECT payment_id AS transaction_id, payment_date AS date, amount, payment_type AS type FROM Payments WHERE loan_id = ? ORDER BY payment_date ASC', [loan_id], (err, transactions) => {
            if (err) {
                return res.status(500).json({ message: 'Error fetching transactions.', error: err.message });
            }

            const totalInterestCalculated = loan.principal_amount * loan.loan_period_years * (loan.interest_rate / 100);
            const originalTotalAmount = loan.principal_amount + totalInterestCalculated;
            const amountPaid = transactions.reduce((sum, t) => sum + t.amount, 0);
            const balanceAmount = originalTotalAmount - amountPaid;

            let emisLeft = 0;
            if (loan.monthly_emi > 0) {
                 emisLeft = Math.ceil(Math.max(0, balanceAmount) / loan.monthly_emi);
            }


            res.status(200).json({
                loan_id: loan.loan_id,
                customer_id: loan.customer_id,
                principal: loan.principal_amount,
                total_amount: originalTotalAmount,
                monthly_emi: loan.monthly_emi,
                amount_paid: amountPaid,
                balance_amount: balanceAmount,
                emis_left: emisLeft,
                status: loan.status,
                transactions: transactions
            });
        });
    });
});

// 2.4. ACCOUNT OVERVIEW: View all loans for a customer
app.get('/api/v1/customers/:customer_id/overview', (req, res) => {
    const { customer_id } = req.params;

    db.all('SELECT * FROM Loans WHERE customer_id = ?', [customer_id], (err, loans) => {
        if (err) {
            return res.status(500).json({ message: 'Database error.', error: err.message });
        }
        if (!loans || loans.length === 0) {
            return res.status(404).json({ message: 'Customer or loans for this customer not found.' });
        }

        const loanPromises = loans.map(loan => {
            return new Promise((resolve, reject) => {
                db.all('SELECT amount FROM Payments WHERE loan_id = ?', [loan.loan_id], (err, payments) => {
                    if (err) {
                        return reject(err);
                    }
                    const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);
                    const totalInterest = loan.principal_amount * loan.loan_period_years * (loan.interest_rate / 100);
                    const totalAmountPayable = loan.principal_amount + totalInterest;
                    const balanceAmount = totalAmountPayable - amountPaid;

                    let emisLeft = 0;
                    if (loan.monthly_emi > 0) {
                        emisLeft = Math.ceil(Math.max(0, balanceAmount) / loan.monthly_emi);
                    }

                    resolve({
                        loan_id: loan.loan_id,
                        principal: loan.principal_amount,
                        total_amount: totalAmountPayable,
                        total_interest: totalInterest,
                        emi_amount: loan.monthly_emi,
                        amount_paid: amountPaid,
                        emis_left: emisLeft,
                        status: loan.status
                    });
                });
            });
        });

        Promise.all(loanPromises)
            .then(resolvedLoans => {
                res.status(200).json({
                    customer_id: customer_id,
                    total_loans: resolvedLoans.length,
                    loans: resolvedLoans
                });
            })
            .catch(error => {
                res.status(500).json({ message: 'Error processing loan details.', error: error.message });
            });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});