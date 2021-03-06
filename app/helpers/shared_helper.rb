module SharedHelper
  def inject_enterprises
    inject_json "enterprises" , "enterprises"
  end

  def inject_json(name, partial, opts = {})
    render partial: "json/injection", locals: {name: name, partial: partial}.merge(opts)
  end

  def distributor_link_class(distributor)
    cart = current_order(true)
    @active_distributors ||= Enterprise.distributors_with_active_order_cycles

    klass = "shop-distributor"
    klass += " empties-cart" unless cart.line_items.empty? || cart.distributor == distributor
    klass += @active_distributors.include?(distributor) ? ' active' : ' inactive'
    klass
  end

  def enterprise_user?
    spree_current_user.andand.enterprises.andand.count.to_i > 0
  end

  def admin_user?
    spree_current_user.andand.has_spree_role? 'admin'
  end
end
