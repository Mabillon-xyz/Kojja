export default function BookConfirmationPage() {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-neutral-400 tracking-widest uppercase mb-3">Koj²a</p>
        <h1 className="text-2xl font-semibold text-neutral-900 mb-3">Demande reçue !</h1>
        <p className="text-sm text-neutral-500 leading-relaxed">
          Votre demande de call a bien été enregistrée. Vous recevrez une confirmation
          par email sous 24h avec le lien de visio.
        </p>
        <p className="text-sm text-neutral-400 mt-6">
          Une question ? Écrivez à{' '}
          <a href="mailto:contact@kojja.fr" className="text-neutral-900 underline underline-offset-2">
            contact@kojja.fr
          </a>
        </p>
      </div>
    </div>
  )
}
