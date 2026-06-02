// utils/generatePaymentReceipt.js
// Requires: npm install pdfkit

const PDFDocument = require('pdfkit');

// Colors matching NYONDO Hardware theme
const DARK_GREEN = '#1a3c2e';
const GOLD       = '#c8960c';
const LIGHT_GRAY = '#f5f5f5';
const MID_GRAY   = '#888888';
const TEXT_DARK  = '#1a1a1a';

/**
 * Generates a professional payment receipt PDF and pipes it to the response.
 *
 * @param {object} res         - Express response object
 * @param {object} payment     - Populated Payment document
 * @param {object} invoice     - Populated CreditInvoice document
 * @param {object} supplier    - Supplier document
 * @param {object} recordedBy  - User who recorded the payment
 */
function generatePaymentReceipt(res, payment, invoice, supplier, recordedBy) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Set response headers so browser downloads the file
  const filename = `receipt-${invoice.invoiceNumber}-${payment._id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const pageWidth  = doc.page.width;
  const leftMargin = 50;
  const rightEdge  = pageWidth - 50;

  // ── HEADER BAND ──────────────────────────────────────────────────────────
  doc.rect(0, 0, pageWidth, 90).fill(DARK_GREEN);

  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(22)
     .text('NYONDO Hardware', leftMargin, 22);

  doc.fillColor(GOLD)
     .font('Helvetica')
     .fontSize(10)
     .text('Building Materials & Hardware Supplies', leftMargin, 48);

  // Receipt label top-right
  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(14)
     .text('PAYMENT RECEIPT', 0, 30, { align: 'right', width: pageWidth - 50 });

  // ── RECEIPT META ROW ─────────────────────────────────────────────────────
  let y = 110;

  doc.rect(leftMargin, y, pageWidth - 100, 60)
     .fill(LIGHT_GRAY);

  doc.fillColor(MID_GRAY)
     .font('Helvetica')
     .fontSize(9)
     .text('RECEIPT NO.', leftMargin + 12, y + 10);
  doc.fillColor(TEXT_DARK)
     .font('Helvetica-Bold')
     .fontSize(10)
     .text(`REC-${payment._id.toString().slice(-8).toUpperCase()}`, leftMargin + 12, y + 22);

  doc.fillColor(MID_GRAY)
     .font('Helvetica')
     .fontSize(9)
     .text('PAYMENT DATE', leftMargin + 160, y + 10);
  doc.fillColor(TEXT_DARK)
     .font('Helvetica-Bold')
     .fontSize(10)
     .text(new Date(payment.paymentDate).toLocaleDateString('en-UG', {
       day: '2-digit', month: 'long', year: 'numeric'
     }), leftMargin + 160, y + 22);

  doc.fillColor(MID_GRAY)
     .font('Helvetica')
     .fontSize(9)
     .text('PAYMENT METHOD', leftMargin + 320, y + 10);
  doc.fillColor(TEXT_DARK)
     .font('Helvetica-Bold')
     .fontSize(10)
     .text(payment.paymentMethod || 'Cash', leftMargin + 320, y + 22);

  // ── SUPPLIER INFO ─────────────────────────────────────────────────────────
  y = 190;
  doc.fillColor(DARK_GREEN)
     .font('Helvetica-Bold')
     .fontSize(10)
     .text('RECEIVED FROM', leftMargin, y);

  doc.moveTo(leftMargin, y + 14).lineTo(rightEdge, y + 14).stroke(GOLD);

  y += 22;
  doc.fillColor(TEXT_DARK)
     .font('Helvetica-Bold')
     .fontSize(13)
     .text(supplier.companyName || '—', leftMargin, y);

  y += 18;
  if (supplier.phone) {
    doc.fillColor(MID_GRAY)
       .font('Helvetica')
       .fontSize(10)
       .text(`Phone: ${supplier.phone}`, leftMargin, y);
    y += 15;
  }
  if (supplier.email) {
    doc.fillColor(MID_GRAY)
       .font('Helvetica')
       .fontSize(10)
       .text(`Email: ${supplier.email}`, leftMargin, y);
    y += 15;
  }
  if (supplier.address) {
    doc.fillColor(MID_GRAY)
       .font('Helvetica')
       .fontSize(10)
       .text(`Address: ${supplier.address}`, leftMargin, y);
    y += 15;
  }

  // ── INVOICE DETAILS TABLE ─────────────────────────────────────────────────
  y += 20;
  doc.fillColor(DARK_GREEN)
     .font('Helvetica-Bold')
     .fontSize(10)
     .text('INVOICE DETAILS', leftMargin, y);

  doc.moveTo(leftMargin, y + 14).lineTo(rightEdge, y + 14).stroke(GOLD);

  y += 22;

  // Table header
  doc.rect(leftMargin, y, pageWidth - 100, 24).fill(DARK_GREEN);
  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(9);
  doc.text('DESCRIPTION',         leftMargin + 10,  y + 7);
  doc.text('INVOICE #',           leftMargin + 190, y + 7);
  doc.text('TOTAL AMOUNT',        leftMargin + 300, y + 7);
  doc.text('OUTSTANDING BEFORE',  leftMargin + 400, y + 7);

  y += 24;

  // Table row
  const outstandingBefore = (invoice.outstanding || 0) + (payment.amount || 0);
  doc.rect(leftMargin, y, pageWidth - 100, 28).fill('#fafafa').stroke('#e0e0e0');
  doc.fillColor(TEXT_DARK)
     .font('Helvetica')
     .fontSize(9);
  doc.text(invoice.description || 'Credit Purchase', leftMargin + 10,  y + 9, { width: 170 });
  doc.text(invoice.invoiceNumber,                    leftMargin + 190, y + 9);
  doc.text(`UGX ${invoice.totalAmount.toLocaleString()}`, leftMargin + 300, y + 9);
  doc.text(`UGX ${outstandingBefore.toLocaleString()}`,   leftMargin + 400, y + 9);

  // ── PAYMENT SUMMARY BOX ───────────────────────────────────────────────────
  y += 50;

  const boxX = pageWidth - 270;
  const boxW = 220;

  // Amount Paid — highlighted
  doc.rect(boxX, y, boxW, 44).fill(DARK_GREEN);
  doc.fillColor(GOLD)
     .font('Helvetica-Bold')
     .fontSize(11)
     .text('AMOUNT PAID', boxX + 12, y + 8);
  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(18)
     .text(`UGX ${payment.amount.toLocaleString()}`, boxX + 12, y + 22);

  y += 52;
  // Remaining balance
  doc.rect(boxX, y, boxW, 32).fill(LIGHT_GRAY).stroke('#ddd');
  doc.fillColor(MID_GRAY)
     .font('Helvetica')
     .fontSize(9)
     .text('REMAINING BALANCE', boxX + 12, y + 7);
  const remaining = Math.max((invoice.outstanding || 0), 0);
  doc.fillColor(remaining > 0 ? '#c0392b' : '#27ae60')
     .font('Helvetica-Bold')
     .fontSize(12)
     .text(`UGX ${remaining.toLocaleString()}`, boxX + 12, y + 18);

  // ── REFERENCE & RECORDED BY ───────────────────────────────────────────────
  y += 50;
  if (payment.reference) {
    doc.fillColor(MID_GRAY)
       .font('Helvetica')
       .fontSize(9)
       .text(`Reference: ${payment.reference}`, leftMargin, y);
    y += 15;
  }
  if (recordedBy) {
    const name = recordedBy.name || recordedBy.username || recordedBy.email || '—';
    doc.fillColor(MID_GRAY)
       .font('Helvetica')
       .fontSize(9)
       .text(`Recorded by: ${name}`, leftMargin, y);
    y += 15;
  }

  // ── STATUS STAMP ──────────────────────────────────────────────────────────
  if (remaining === 0) {
    doc.save();
    doc.rotate(-30, { origin: [300, 400] });
    doc.rect(160, 360, 200, 50).stroke(GOLD);
    doc.fillColor(GOLD)
       .font('Helvetica-Bold')
       .fontSize(28)
       .opacity(0.2)
       .text('FULLY PAID', 165, 370);
    doc.restore();
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footerY = doc.page.height - 60;
  doc.rect(0, footerY, pageWidth, 60).fill(DARK_GREEN);
  doc.fillColor('#ffffff')
     .font('Helvetica')
     .fontSize(8)
     .opacity(1)
     .text('Thank you for doing business with NYONDO Hardware', 0, footerY + 12, { align: 'center', width: pageWidth });
  doc.fillColor(GOLD)
     .fontSize(7)
     .text(`Generated on ${new Date().toLocaleString('en-UG')} · This is a computer-generated receipt`, 0, footerY + 28, { align: 'center', width: pageWidth });

  doc.end();
}

module.exports = generatePaymentReceipt;
