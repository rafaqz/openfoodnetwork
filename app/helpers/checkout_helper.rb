module CheckoutHelper
  def checkout_adjustments_for_summary(order, opts={})
    adjustments = order.adjustments.eligible

    # Remove empty tax adjustments and (optionally) shipping fees
    adjustments.reject! { |a| a.originator_type == 'Spree::TaxRate' && a.amount == 0 }
    adjustments.reject! { |a| a.originator_type == 'Spree::ShippingMethod' } if opts[:exclude_shipping]

    enterprise_fee_adjustments = adjustments.select { |a| a.originator_type == 'EnterpriseFee' }
    adjustments.reject! { |a| a.originator_type == 'EnterpriseFee' }
    adjustments << Spree::Adjustment.new(label: 'Distribution', amount: enterprise_fee_adjustments.sum(&:amount))

    adjustments
  end

  def validated_input(name, path, args = {})
    attributes = {
      required: true,
      type: :text,
      name: path,
      id: path,
      "ng-model" => path,
      "ng-class" => "{error: !fieldValid('#{path}')}" 
    }.merge args
    
    render partial: "shared/validated_input", locals: {name: name, path: path, attributes: attributes}
  end
end
