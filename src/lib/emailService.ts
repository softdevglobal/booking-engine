import nodemailer from 'nodemailer';

class EmailService {
	private transporter: nodemailer.Transporter;

	constructor() {
		this.transporter = nodemailer.createTransport({
			service: 'gmail',
			auth: {
				user: 'dpawan434741@gmail.com',
				pass: 'tmoltlllrsvpflkm'
			}
		});
	}

	async sendBookingNotificationToHallOwner(bookingData: {
		bookingId: string;
		bookingCode?: string;
		customerName: string;
		customerEmail: string;
		customerPhone: string;
		eventType: string;
		hallName: string;
		bookingDate: string;
		startTime: string;
		endTime: string;
		guestCount: number | null;
		calculatedPrice: number;
		hallOwnerEmail: string;
	}) {
		const subject = `New Booking Request - ${bookingData.customerName}`;
		const html = `<p>New booking request for ${bookingData.hallName} on ${bookingData.bookingDate}.</p>`;
		const mailOptions = { from: 'dpawan434741@gmail.com', to: bookingData.hallOwnerEmail, subject, html };
		return this.transporter.sendMail(mailOptions);
	}

	async sendBookingConfirmationToCustomer(bookingData: {
		bookingId: string;
		bookingCode?: string;
		customerName: string;
		customerEmail: string;
		eventType: string;
		hallName: string;
		bookingDate: string;
		startTime: string;
		endTime: string;
		guestCount: number | null;
		calculatedPrice: number;
	}) {
		const subject = `Booking Request Received - ${bookingData.eventType} at ${bookingData.hallName}`;
		const html = `<p>Hi ${bookingData.customerName}, your booking request has been received.</p>`;
		const mailOptions = { from: 'dpawan434741@gmail.com', to: bookingData.customerEmail, subject, html };
		return this.transporter.sendMail(mailOptions);
	}
}

export const emailService = new EmailService();


