Pod::Spec.new do |s|
  s.name           = 'TvNet'
  s.version        = '1.0.0'
  s.summary        = 'Home-network sockets for controlling TVs from TunedTV'
  s.description    = 'TCP/TLS sockets, UDP, port scan and Bonjour browse, limited to private addresses by the JS bridge.'
  s.license        = 'UNLICENSED'
  s.author         = 'TunedTV'
  s.homepage       = 'https://tunedtv.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
