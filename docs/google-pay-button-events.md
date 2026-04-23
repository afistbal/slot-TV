object

authorized
GooglePayAuthorizedEvent

This event will be fired when the user authorizes the payment.

Example
linkTypeScript
  element.on('authorized', (e) => {
    const { paymentData } = e.detail;
    console.log('Payment authorized', paymentData);
  });
cancel
undefined

This event will be fired when payment is cancelled.

Example
linkTypeScript
  element.on('cancel', ( ) => void);
click
undefined

This event will be fired when the user clicks the button.

Example
linkTypeScript
  element.on('click', () => void);
error
ErrorEvent

This event will be fired when form encounters an unexpected error.

Example
linkTypeScript
  element.on('error', (e) => {
    const { error } = e.detail;
     console.error('There is an error', error);
  });
ready
undefined

This event will be fired when form is ready to interact with the user.

Example
linkTypeScript
  element.on('ready',( ) => void);
shippingAddressChange
GooglePayIntermediatePaymentData

This event will be fired when the shipping address changes.

Example
linkTypeScript
  element.on('shippingAddressChange', (e) => {
    const { intermediatePaymentData } = e.detail;
    console.log('Shipping address changed', intermediatePaymentData);
  });
shippingMethodChange
GooglePayIntermediatePaymentData

This event will be fired when the shipping method changes.

Example
linkTypeScript
  element.on('shippingMethodChange', (e) => {
    const { intermediatePaymentData } = e.detail;
    console.log('Shipping method changed', intermediatePaymentData);
  });
success
SuccessEvent

This event will be fired when payment is successful. It can be used to redirect the user to the success page.

Example
linkTypeScript
  element.on('success', (e) => {
    const { intent, consent } = e.detail;
    console.log('Payment is successful', { intent, consent });
  });