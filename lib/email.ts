import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendVerificationEmail(to: string, verifyLink: string) {
  const { error } = await resend.emails.send({
    from: 'Bakex <noreply@bakexsystem.com>',
    to,
    subject: 'تأكيد البريد الإلكتروني — Bakex',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 28px; font-weight: 800; color: #0f172a;">Bake<span style="color: #16a679;">x</span></span>
        </div>
        <div style="background: #fff; border-radius: 10px; padding: 28px; border: 1px solid #e2e8f0;">
          <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">أكّد بريدك الإلكتروني</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 20px;">
            شكراً لتسجيلك في Bakex. اضغط على الزر أدناه لتأكيد بريدك الإلكتروني وتفعيل حسابك.
          </p>
          <a href="${verifyLink}"
            style="display: block; background: #16a679; color: #fff; text-decoration: none; text-align: center; padding: 14px; border-radius: 10px; font-size: 15px; font-weight: 700; margin-bottom: 20px;">
            تأكيد البريد الإلكتروني
          </a>
          <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
            الرابط صالح لمدة 24 ساعة.<br/>
            إذا لم تسجّل في Bakex، تجاهل هذا الإيميل.
          </p>
        </div>
      </div>
    `,
  })
  if (error) throw error
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const { error } = await resend.emails.send({
    from: 'Bakex <noreply@bakexsystem.com>',
    to,
    subject: 'إعادة تعيين كلمة المرور — Bakex',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 28px; font-weight: 800; color: #0f172a;">Bake<span style="color: #16a679;">x</span></span>
        </div>
        <div style="background: #fff; border-radius: 10px; padding: 28px; border: 1px solid #e2e8f0;">
          <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">إعادة تعيين كلمة المرور</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 20px;">
            تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك. اضغط على الزر أدناه لتعيين كلمة مرور جديدة.
          </p>
          <a href="${resetLink}"
            style="display: block; background: #16a679; color: #fff; text-decoration: none; text-align: center; padding: 14px; border-radius: 10px; font-size: 15px; font-weight: 700; margin-bottom: 20px;">
            إعادة تعيين كلمة المرور
          </a>
          <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
            الرابط صالح لمدة 15 دقيقة فقط.<br/>
            إذا لم تطلب إعادة التعيين، تجاهل هذا الإيميل.
          </p>
        </div>
      </div>
    `,
  })
  if (error) throw error
}
